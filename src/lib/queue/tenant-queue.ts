import { db } from '../db';
import { logger } from '../logger';
import { CircuitBreaker } from '../evolution';

export interface TenantLoadStats {
  tenantId: string;
  tenantName: string;
  planName: string;
  activeCampaignsCount: number;
  activeCampaignNames: string[];
  pendingRecipients: number;
  inFlight: number;
  sentToday: number;
  sentLastHour: number;
  activeInstances: string[];
  status: 'ACTIVE' | 'IDLE' | 'THROTTLED' | 'WAITING_INSTANCE' | 'WINDOW_SLEEP';
  fairShareWeight: number;
}

export interface InstanceWorkloadStats {
  instanceName: string;
  phone?: string | null;
  status: 'TRANSMITTING' | 'PACING' | 'IDLE' | 'CIRCUIT_OPEN' | 'DAILY_CAP';
  currentTenantId?: string | null;
  currentCampaignId?: string | null;
  todaySent: number;
  dailyCap: number;
  utilizationPercent: number;
  lastTransmissionAt?: string | null;
}

export interface SystemLoadMetrics {
  timestamp: string;
  eventLoopHealth: 'OPTIMAL' | 'DEGRADED' | 'HIGH_LOAD';
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    utilizationPercent: number;
  };
  queue: {
    dispatcherState: 'ROUND_ROBIN_ACTIVE' | 'IDLE';
    totalQueuedRecipients: number;
    totalInFlight: number;
    activeTenantsCount: number;
    activeCampaignsCount: number;
    messagesPerMinute: number;
    messagesLastHour: number;
  };
  tenants: TenantLoadStats[];
  instances: InstanceWorkloadStats[];
}

// -------------------------------------------------------------
// In-Memory Rolling Metrics & Locks
// -------------------------------------------------------------
const rollingDispatches: number[] = []; // Timestamps of sent messages
const instanceLocks = new Map<string, {
  locked: boolean;
  lockedByCampaignId?: string;
  lockedByTenantId?: string;
  lockedAt: number;
  unlockAt: number;
  status: 'TRANSMITTING' | 'PACING' | 'IDLE';
}>();

const tenantInFlightMap = new Map<string, number>();
const MAX_CONCURRENT_DISPATCHES_PER_TENANT = 5;

/**
 * Records a successful message transmission for real-time velocity calculations
 */
export function recordDispatchTelemetry(instanceName: string, campaignId: string, tenantId: string = 'default') {
  const now = Date.now();
  rollingDispatches.push(now);

  // Prune entries older than 1 hour to prevent memory growth
  const oneHourAgo = now - 3600 * 1000;
  while (rollingDispatches.length > 0 && rollingDispatches[0]! < oneHourAgo) {
    rollingDispatches.shift();
  }

  // Update instance lock state to PACING
  const existing = instanceLocks.get(instanceName);
  if (existing) {
    existing.status = 'PACING';
    existing.lockedByCampaignId = campaignId;
    existing.lockedByTenantId = tenantId;
  }
}

/**
 * Attempts to acquire an exclusive transmission lock for a specific WhatsApp instance.
 * Guarantees that two concurrent tenant campaigns never transmit simultaneously on the same WhatsApp account.
 */
export function acquireInstanceLock(
  instanceName: string,
  campaignId: string,
  tenantId: string = 'default',
  durationMs: number = 20000
): boolean {
  const now = Date.now();
  const lock = instanceLocks.get(instanceName);

  if (lock && lock.locked && now < lock.unlockAt && lock.lockedByCampaignId !== campaignId) {
    return false; // Instance is busy with another campaign
  }

  instanceLocks.set(instanceName, {
    locked: true,
    lockedByCampaignId: campaignId,
    lockedByTenantId: tenantId,
    lockedAt: now,
    unlockAt: now + durationMs,
    status: 'TRANSMITTING',
  });

  return true;
}

/**
 * Releases or clears the transmission lock for an instance
 */
export function releaseInstanceLock(instanceName: string, campaignId?: string) {
  const lock = instanceLocks.get(instanceName);
  if (!lock) return;

  if (!campaignId || lock.lockedByCampaignId === campaignId) {
    instanceLocks.set(instanceName, {
      locked: false,
      lockedAt: 0,
      unlockAt: 0,
      status: 'IDLE',
    });
  }
}

/**
 * Increment / Decrement in-flight counter per tenant
 */
export function trackTenantInFlight(tenantId: string, delta: number) {
  const current = tenantInFlightMap.get(tenantId) || 0;
  const next = Math.max(0, current + delta);
  tenantInFlightMap.set(tenantId, next);
}

export function isTenantConcurrencyAvailable(tenantId: string): boolean {
  const current = tenantInFlightMap.get(tenantId) || 0;
  return current < MAX_CONCURRENT_DISPATCHES_PER_TENANT;
}

/**
 * Computes live multi-tenant workload, queue depths, and hardware load metrics
 */
export async function getSystemLoadMetrics(): Promise<SystemLoadMetrics> {
  const now = Date.now();
  const memory = process.memoryUsage();

  // 1. Calculate Velocity (Last 60s and Last 60m)
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 3600 * 1000;
  let mpm = 0;
  let mph = 0;

  for (const t of rollingDispatches) {
    if (t >= oneMinuteAgo) mpm++;
    if (t >= oneHourAgo) mph++;
  }

  // 2. Fetch Active & Queued Campaigns
  const [activeCampaigns, queuedRecipientCount, clients, instances] = await Promise.all([
    db.campaign.findMany({
      where: { status: { in: ['RUNNING', 'SCHEDULED'] } },
      select: {
        id: true,
        name: true,
        status: true,
        createdById: true,
        createdAt: true,
        instances: { select: { instance: { select: { name: true } } } },
      },
    }),
    db.campaignRecipient.count({
      where: { status: { in: ['PENDING', 'QUEUED', 'RETRY_WAIT'] } },
    }),
    db.resellerClient.findMany({
      select: {
        id: true,
        companyName: true,
        planName: true,
        status: true,
        monthlyMsgCap: true,
      },
    }).catch(() => []),
    db.instance.findMany({
      select: {
        name: true,
        profileNumber: true,
        status: true,
        dailyCap: true,
        sentToday: true,
      },
    }).catch(() => []),
  ]);

  // Map client lookup
  const clientMap = new Map<string, any>();
  for (const c of clients) {
    clientMap.set(c.id, c);
  }

  // 3. Group Active Campaigns by Tenant
  const tenantGroups = new Map<string, {
    tenantId: string;
    tenantName: string;
    planName: string;
    campaigns: any[];
  }>();

  // Default Platform Admin Tenant
  tenantGroups.set('admin', {
    tenantId: 'admin',
    tenantName: 'Platform Administrator',
    planName: 'Super Admin',
    campaigns: [],
  });

  for (const c of activeCampaigns) {
    // If createdBy matches a reseller client, attribute to tenant
    const matchedClient = (c as any).clientId
      ? clientMap.get((c as any).clientId)
      : c.createdById ? clientMap.get(c.createdById) : null;

    const tid = matchedClient?.id || 'admin';
    if (!tenantGroups.has(tid)) {
      tenantGroups.set(tid, {
        tenantId: tid,
        tenantName: matchedClient?.companyName || 'Enterprise Tenant',
        planName: matchedClient?.planName || 'Growth',
        campaigns: [],
      });
    }
    tenantGroups.get(tid)!.campaigns.push(c);
  }

  // 4. Calculate Per-Tenant Queue Depths and Workload
  const tenantStatsList: TenantLoadStats[] = [];

  for (const [tid, grp] of tenantGroups.entries()) {
    const campaignIds = grp.campaigns.map((c) => c.id);
    let pendingCount = 0;
    let assignedInstanceNames: string[] = [];

    if (campaignIds.length > 0) {
      pendingCount = await db.campaignRecipient.count({
        where: {
          campaignId: { in: campaignIds },
          status: { in: ['PENDING', 'QUEUED', 'RETRY_WAIT'] },
        },
      }).catch(() => 0);

      const instSet = new Set<string>();
      for (const c of grp.campaigns) {
        for (const ci of c.instances || []) {
          if (ci.instance?.name) instSet.add(ci.instance.name);
        }
      }
      assignedInstanceNames = Array.from(instSet);
    }

    const inFlight = tenantInFlightMap.get(tid) || (grp.campaigns.some(c => c.status === 'RUNNING') ? 1 : 0);
    const isRunning = grp.campaigns.some((c) => c.status === 'RUNNING');

    let status: TenantLoadStats['status'] = 'IDLE';
    if (isRunning) {
      status = inFlight >= MAX_CONCURRENT_DISPATCHES_PER_TENANT ? 'THROTTLED' : 'ACTIVE';
    } else if (pendingCount > 0) {
      status = 'WAITING_INSTANCE';
    }

    tenantStatsList.push({
      tenantId: tid,
      tenantName: grp.tenantName,
      planName: grp.planName,
      activeCampaignsCount: grp.campaigns.length,
      activeCampaignNames: grp.campaigns.map((c) => c.name),
      pendingRecipients: pendingCount,
      inFlight,
      sentToday: 0,
      sentLastHour: Math.round(mph / Math.max(1, tenantGroups.size)),
      activeInstances: assignedInstanceNames,
      status,
      fairShareWeight: tid === 'admin' ? 1.5 : (grp.planName === 'Enterprise' ? 2.0 : 1.0),
    });
  }

  // 5. Calculate Instance Workloads
  const instanceStatsList: InstanceWorkloadStats[] = instances.map((inst) => {
    const lock = instanceLocks.get(inst.name);
    const isTransmitting = lock?.locked && now < lock.unlockAt;
    const isCircuitOpen = CircuitBreaker.getState(inst.name) === 'open';
    const isCapReached = (inst.sentToday || 0) >= (inst.dailyCap || 200);

    let status: InstanceWorkloadStats['status'] = 'IDLE';
    if (isCircuitOpen) status = 'CIRCUIT_OPEN';
    else if (isCapReached) status = 'DAILY_CAP';
    else if (isTransmitting) status = lock?.status === 'PACING' ? 'PACING' : 'TRANSMITTING';

    const utilization = Math.min(100, Math.round(((inst.sentToday || 0) / Math.max(1, inst.dailyCap || 200)) * 100));

    return {
      instanceName: inst.name,
      phone: inst.profileNumber || null,
      status,
      currentTenantId: lock?.lockedByTenantId || null,
      currentCampaignId: lock?.lockedByCampaignId || null,
      todaySent: inst.sentToday || 0,
      dailyCap: inst.dailyCap || 200,
      utilizationPercent: utilization,
      lastTransmissionAt: lock?.lockedAt ? new Date(lock.lockedAt).toISOString() : null,
    };
  });

  // 6. Memory & Event Loop
  const heapUtil = Math.round((memory.heapUsed / memory.heapTotal) * 100);
  const eventLoopHealth: SystemLoadMetrics['eventLoopHealth'] = heapUtil > 85 ? 'HIGH_LOAD' : (heapUtil > 70 ? 'DEGRADED' : 'OPTIMAL');

  return {
    timestamp: new Date().toISOString(),
    eventLoopHealth,
    memory: {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 10) / 10,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 10) / 10,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 10) / 10,
      utilizationPercent: heapUtil,
    },
    queue: {
      dispatcherState: activeCampaigns.some((c) => c.status === 'RUNNING') ? 'ROUND_ROBIN_ACTIVE' : 'IDLE',
      totalQueuedRecipients: queuedRecipientCount,
      totalInFlight: Array.from(tenantInFlightMap.values()).reduce((a, b) => a + b, 0),
      activeTenantsCount: tenantStatsList.filter((t) => t.pendingRecipients > 0 || t.activeCampaignsCount > 0).length,
      activeCampaignsCount: activeCampaigns.length,
      messagesPerMinute: mpm,
      messagesLastHour: mph,
    },
    tenants: tenantStatsList,
    instances: instanceStatsList,
  };
}
