import { db, ensureDbSchema } from './lib/db';
import { campaignRunner } from './lib/queue/campaign-runner';
import { warmerRunner } from './lib/warmer/warmer-runner';
import { logger, recordSystemLog } from './lib/logger';

console.log('=== WhatsApp Campaign Background Worker v2 Started ===');
logger.info('Background worker polling loop and reconciler initialized.');

// Record worker start in DB
recordSystemLog('info', 'worker', 'WhatsApp Campaign Background Worker started', {
  pid: process.pid,
  nodeVersion: process.version,
  uptime: Math.floor(process.uptime()),
}).catch(() => {});

// Ensure SQLite schema columns & tables exist, then run startup reconciliation
ensureDbSchema()
  .then(() => campaignRunner.reconcileStartup())
  .then(() => {
    logger.info('Startup reconciliation completed successfully.');
    recordSystemLog('info', 'worker', 'Startup reconciliation completed successfully.').catch(() => {});
  })
  .catch((err) => {
    logger.error({ err: err.message }, 'Failed during startup reconciliation');
    recordSystemLog('error', 'worker', `Failed during startup reconciliation: ${err.message}`, {
      stack: err.stack,
    }).catch(() => {});
  });

let isChecking = false;

async function updateHeartbeat() {
  try {
    const memory = process.memoryUsage();
    const activeCampaignIds = campaignRunner.getActiveCampaignIds ? campaignRunner.getActiveCampaignIds() : [];

    const metadata = JSON.stringify({
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round((memory.rss / (1024 * 1024)) * 10) / 10,
      memoryHeapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 10) / 10,
      activeCampaignsCount: activeCampaignIds.length,
      activeCampaignIds,
    });

    await db.workerHeartbeat.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        status: 'ACTIVE',
        lastSeen: new Date(),
        metadata,
      },
      update: {
        status: 'ACTIVE',
        lastSeen: new Date(),
        metadata,
      },
    });
  } catch (err) {
    // Silently ignore heartbeat upsert failure to avoid stopping the loop
  }
}

async function checkAndRunScheduledCampaigns() {
  if (isChecking) return;
  isChecking = true;

  try {
    await ensureDbSchema();
    await updateHeartbeat();

    const now = new Date();

    // Look for running campaigns that might have been interrupted by restart, or scheduled campaigns ready to run
    const activeOrScheduled = await db.campaign.findMany({
      where: {
        OR: [
          { status: 'RUNNING' },
          {
            status: 'SCHEDULED',
            scheduledAt: { lte: now },
          },
        ],
      },
    });

    for (const camp of activeOrScheduled) {
      if (!campaignRunner.isCampaignActive(camp.id)) {
        logger.info({ campaignId: camp.id, name: camp.name }, 'Worker picking up campaign');
        recordSystemLog('info', 'worker', `Worker picking up campaign "${camp.name}" (${camp.status})`, {
          campaignId: camp.id,
          status: camp.status,
        }).catch(() => {});

        campaignRunner.runCampaign(camp.id).catch((err) => {
          logger.error({ err, campaignId: camp.id }, 'Error running campaign from worker');
          recordSystemLog('error', 'worker', `Error running campaign "${camp.name}": ${err.message}`, {
            campaignId: camp.id,
            stack: err.stack,
          }).catch(() => {});
        });
      }
    }

    // Advance and monitor active peer-to-peer Number Warmer sessions
    await warmerRunner.checkAndRunSessions();
  } catch (err: any) {
    logger.error({ err: err.message }, 'Worker poll check error');
    recordSystemLog('error', 'worker', `Worker poll check error: ${err.message}`, {
      stack: err.stack,
    }).catch(() => {});
  } finally {
    isChecking = false;
  }
}

// Poll and emit heartbeat every 5 seconds
setInterval(checkAndRunScheduledCampaigns, 5000);
checkAndRunScheduledCampaigns();
