'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Terminal,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  Server,
  Cpu,
  Database,
  Play,
  Pause,
  ChevronDown,
  ChevronRight,
  Activity,
  ExternalLink,
  Sparkles,
  Users,
  Layers,
  Zap,
  Gauge,
  ShieldCheck,
  ArrowRightLeft,
  Radio,
  Clock,
  ShieldAlert,
} from 'lucide-react';

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
  eventLoopLagMs?: number;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    heapLimitMb?: number;
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

interface SystemLogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  details: string | null;
  createdAt: string;
}

interface WorkerStats {
  isOnline: boolean;
  lastSeen: string | null;
  secondsAgo: number | null;
  status: string;
  metadata: {
    pid?: number;
    uptimeSeconds?: number;
    memoryRssMb?: number;
    memoryHeapUsedMb?: number;
    activeCampaignsCount?: number;
    activeCampaignIds?: string[];
    [key: string]: any;
  } | null;
}

interface LogStats {
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
}

interface SystemLogsConsoleProps {
  connectedInstancesCount?: number;
}

export function SystemLogsConsole({ connectedInstancesCount = 0 }: SystemLogsConsoleProps) {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [worker, setWorker] = useState<WorkerStats | null>(null);
  const [stats, setStats] = useState<LogStats>({
    totalLogs: 0,
    errorCount: 0,
    warnCount: 0,
    infoCount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [loadMetrics, setLoadMetrics] = useState<SystemLoadMetrics | null>(null);

  const fetchLogs = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '200');
      if (selectedLevel !== 'all') params.set('level', selectedLevel);
      if (selectedSource !== 'all') params.set('source', selectedSource);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/system/logs?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.logs || []);
        if (data.worker) setWorker(data.worker);
        if (data.stats) setStats(data.stats);
        if (data.loadMetrics) setLoadMetrics(data.loadMetrics);
      }
    } catch (err: any) {
      console.error('Failed to load system logs:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [selectedLevel, selectedSource, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  // Polling loop (every 3.5s if autoRefresh is active)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 3500);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  // Handle Clear Logs
  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear stored system logs?')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/system/logs', { method: 'DELETE' });
      if (res.ok) {
        await fetchLogs(true);
      }
    } catch (err) {
      console.error('Failed to clear logs:', err);
    } finally {
      setClearing(false);
    }
  };

  // Handle Copy All Logs
  const handleCopyLogs = () => {
    const text = logs
      .map((l) => {
        const time = new Date(l.createdAt).toISOString();
        const header = `[${time}] [${l.level.toUpperCase()}] [${l.source}]: ${l.message}`;
        return l.details ? `${header}\n  DETAILS: ${l.details}` : header;
      })
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle Send Diagnostic Ping
  const handleSendPing = async () => {
    setPingStatus('Sending ping...');
    try {
      const res = await fetch('/api/system/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Diagnostic ping from user console',
          level: 'info',
          source: 'app',
          details: { triggeredByUser: true, timestamp: new Date().toISOString() },
        }),
      });
      if (res.ok) {
        setPingStatus('Ping recorded! Refreshing...');
        await fetchLogs(false);
        setTimeout(() => setPingStatus(null), 3000);
      } else {
        setPingStatus('Ping failed');
        setTimeout(() => setPingStatus(null), 3000);
      }
    } catch {
      setPingStatus('Ping error');
      setTimeout(() => setPingStatus(null), 3000);
    }
  };

  // Formatted uptime
  const formatUptime = (seconds?: number) => {
    if (!seconds && seconds !== 0) return 'N/A';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 5) return 'just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      return `${diffHours}h ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Title & Quick Links */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <span>System Health & Live Container Logs</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Dokploy In-App Diagnostics
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-container telemetry, background worker heartbeat, and streaming diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pingStatus && (
            <span className="text-xs text-emerald-400 font-mono animate-pulse">{pingStatus}</span>
          )}

          <button
            onClick={handleSendPing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700/60 transition"
            title="Inject a test event to verify live log writing"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Test Ping</span>
          </button>

          <a
            href="/api/metrics"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-mono border border-slate-700/60 transition"
          >
            <span>/api/metrics</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* 2. Diagnostics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Background Worker */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Background Worker</span>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  worker?.isOnline
                    ? 'bg-emerald-400 shadow-md shadow-emerald-400/50 animate-pulse'
                    : 'bg-rose-500 shadow-md shadow-rose-500/50'
                }`}
              />
              <span className={`text-[11px] font-mono font-bold ${worker?.isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                {worker?.isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>campaign-worker</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              {worker?.secondsAgo !== null && worker?.secondsAgo !== undefined ? (
                <>Heartbeat: <span className="text-white font-semibold">{worker.secondsAgo}s ago</span></>
              ) : (
                'No heartbeat yet'
              )}
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
            <div>
              <span>PID:</span> <span className="text-slate-200">{worker?.metadata?.pid ?? 'N/A'}</span>
            </div>
            <div>
              <span>Uptime:</span> <span className="text-slate-200">{formatUptime(worker?.metadata?.uptimeSeconds)}</span>
            </div>
            <div>
              <span>RSS Mem:</span> <span className="text-slate-200">{worker?.metadata?.memoryRssMb ? `${worker.metadata.memoryRssMb} MB` : 'N/A'}</span>
            </div>
            <div>
              <span>Active Jobs:</span> <span className="text-emerald-400 font-bold">{worker?.metadata?.activeCampaignsCount ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Card 2: SQLite Shared Database */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Shared Database</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/50" />
              <span className="text-[11px] font-mono font-bold text-emerald-400">IN SYNC</span>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-400" />
              <span>SQLite prod.db</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Auto-repair schema sync <span className="text-emerald-400">active</span>
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
            <div>
              <span>Volume:</span> <span className="text-slate-200">/app/prisma</span>
            </div>
            <div>
              <span>Logs Stored:</span> <span className="text-slate-200">{stats.totalLogs}</span>
            </div>
            <div className="col-span-2">
              <span>Status:</span> <span className="text-emerald-400">Zero-downtime persistence</span>
            </div>
          </div>
        </div>

        {/* Card 3: Evolution Engine */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Evolution Engine</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${connectedInstancesCount > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className={`text-[11px] font-mono font-bold ${connectedInstancesCount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {connectedInstancesCount > 0 ? 'READY' : 'STANDBY'}
              </span>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Evolution API</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              Connected Instances: <span className="text-emerald-400 font-bold">{connectedInstancesCount}</span>
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
            <div>
              <span>Webhook:</span> <span className="text-slate-200">Self-healing</span>
            </div>
            <div>
              <span>Port:</span> <span className="text-slate-200">8080/internal</span>
            </div>
            <div className="col-span-2">
              <span>Delivery ACK:</span> <span className="text-emerald-400">Monotonic state machine</span>
            </div>
          </div>
        </div>

        {/* Card 4: Error & Warning Tracker */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Diagnostic Health</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>

          <div className="mt-3 flex items-baseline gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black font-mono ${stats.errorCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {stats.errorCount}
              </span>
              <span className="text-xs text-slate-400">Errors</span>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <span className={`text-2xl font-black font-mono ${stats.warnCount > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                {stats.warnCount}
              </span>
              <span className="text-xs text-slate-400">Warnings</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
            {stats.errorCount === 0 ? (
              <span className="text-emerald-400 font-medium">✓ No unhandled crashes recorded</span>
            ) : (
              <span className="text-rose-400 font-medium">⚠ Review error entries in the log below</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Multi-Tenant Broadcast Queue & Engine Load Distribution Monitor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-5 space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
                <Layers className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Multi-Tenant Broadcast Queue & System Load Distribution</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                    loadMetrics?.queue?.dispatcherState === 'ROUND_ROBIN_ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {loadMetrics?.queue?.dispatcherState === 'ROUND_ROBIN_ACTIVE' ? 'ROUND-ROBIN DISPATCHING' : 'IDLE QUEUE'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fair-share round-robin isolation, per-tenant concurrency throttling (max 5 in-flight), and zero-collision instance locking.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="bg-slate-950/70 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2 text-slate-300">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Velocity:</span>
              <span className="text-emerald-400 font-bold">{loadMetrics?.queue?.messagesPerMinute || 0} MPM</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-300">{loadMetrics?.queue?.messagesLastHour || 0} MPH</span>
            </div>
          </div>
        </div>

        {/* 4 Load Metric Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Event Loop & Health */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                Event Loop & Health
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                loadMetrics?.eventLoopHealth === 'OPTIMAL'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : loadMetrics?.eventLoopHealth === 'DEGRADED'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {loadMetrics?.eventLoopHealth || 'OPTIMAL'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-bold font-mono text-white">
                {loadMetrics?.memory?.utilizationPercent || 2}%
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Lag: <span className="text-emerald-400 font-bold">{loadMetrics?.eventLoopLagMs ?? 0}ms</span>
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  (loadMetrics?.memory?.utilizationPercent || 2) > 85 ? 'bg-rose-500' : (loadMetrics?.memory?.utilizationPercent || 2) > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(3, loadMetrics?.memory?.utilizationPercent || 2))}%` }}
              />
            </div>
            <div className="mt-2 text-[10px] font-mono text-slate-400 flex justify-between">
              <span>RSS: {loadMetrics?.memory?.rssMb || 0} MB</span>
              <span>Heap: {loadMetrics?.memory?.heapUsedMb || 0} / {loadMetrics?.memory?.heapLimitMb || 2048} MB</span>
            </div>
          </div>

          {/* Card 2: Queued Backlog */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Global Backlog Depth
              </span>
              <span className="text-[10px] font-mono text-slate-300">Recipients</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-bold font-mono text-sky-400">
                {loadMetrics?.queue?.totalQueuedRecipients || 0}
              </span>
              <span className="text-[11px] font-mono text-slate-400">Pending Broadcast</span>
            </div>
            <div className="mt-3 text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>Active Broadcasts:</span>
              <span className="text-white font-bold">{loadMetrics?.queue?.activeCampaignsCount || 0} campaigns</span>
            </div>
          </div>

          {/* Card 3: In-Flight Concurrency */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                In-Flight Concurrency
              </span>
              <span className="text-[10px] font-mono text-indigo-400">Fair-Share</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-bold font-mono text-indigo-400">
                {loadMetrics?.queue?.totalInFlight || 0}
              </span>
              <span className="text-[11px] font-mono text-slate-400">Active Transmissions</span>
            </div>
            <div className="mt-3 text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>Per-Tenant Throttle:</span>
              <span className="text-white font-bold">Max 5 in-flight</span>
            </div>
          </div>

          {/* Card 4: Multi-Tenant Pool */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Tenant Isolation Pool
              </span>
              <span className="text-[10px] font-mono text-emerald-400">Multi-Client</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-bold font-mono text-emerald-400">
                {loadMetrics?.queue?.activeTenantsCount || 0}
              </span>
              <span className="text-[11px] font-mono text-slate-400">Broadcasting Now</span>
            </div>
            <div className="mt-3 text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>Instance Collision Lock:</span>
              <span className="text-emerald-400 font-bold">Guaranteed</span>
            </div>
          </div>
        </div>

        {/* Tenant Workload Queue Breakdown Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <span>Tenant Queue Distribution & Workload Allocation</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono font-normal">
              {(loadMetrics?.tenants || []).length} registered tenant environment(s)
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-mono text-slate-400 bg-slate-900/50 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Tenant & Plan</th>
                  <th className="py-2.5 px-3">Active Campaigns</th>
                  <th className="py-2.5 px-3">Queue Depth</th>
                  <th className="py-2.5 px-3">In-Flight / Cap</th>
                  <th className="py-2.5 px-3">Assigned Instances</th>
                  <th className="py-2.5 px-3">Fair-Share</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {(!loadMetrics?.tenants || loadMetrics.tenants.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500 text-xs">
                      No active tenant queues detected. Platform is standing by.
                    </td>
                  </tr>
                ) : (
                  loadMetrics.tenants.map((t) => (
                    <tr key={t.tenantId} className="hover:bg-slate-900/40 transition">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-white font-sans text-xs">{t.tenantName}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded text-[9px]">{t.planName}</span>
                          <span className="text-slate-500">ID: {t.tenantId.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {t.activeCampaignNames.length === 0 ? (
                          <span className="text-slate-500">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {t.activeCampaignNames.slice(0, 2).map((name, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px]">
                                {name}
                              </span>
                            ))}
                            {t.activeCampaignNames.length > 2 && (
                              <span className="text-[10px] text-slate-400 font-bold">+{t.activeCampaignNames.length - 2} more</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-bold ${t.pendingRecipients > 0 ? 'text-sky-400' : 'text-slate-500'}`}>
                          {t.pendingRecipients}
                        </span>
                        <span className="text-slate-500 text-[10px] ml-1">queued</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${t.inFlight > 0 ? 'text-indigo-400' : 'text-slate-500'}`}>
                            {t.inFlight} / 5
                          </span>
                          <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-400 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, (t.inFlight / 5) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {t.activeInstances.length === 0 ? (
                          <span className="text-slate-500">Auto-pool</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {t.activeInstances.map((inst, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                {inst}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                          {t.fairShareWeight.toFixed(1)}x Weight
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : t.status === 'THROTTLED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : t.status === 'WAITING_INSTANCE'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* WhatsApp Instances Workload & Collision Lock Monitor */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp Instance Workload & Anti-Collision Locks</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono font-normal">
              {(loadMetrics?.instances || []).length} instance account(s) monitored
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(!loadMetrics?.instances || loadMetrics.instances.length === 0) ? (
              <div className="col-span-3 py-4 text-center text-slate-500 text-xs font-mono bg-slate-950/50 rounded-xl border border-slate-800">
                No instances connected. Create and link WhatsApp accounts in the Instances tab.
              </div>
            ) : (
              loadMetrics.instances.map((inst) => {
                const isTransmitting = inst.status === 'TRANSMITTING';
                const isPacing = inst.status === 'PACING';
                const isDailyCap = inst.status === 'DAILY_CAP';
                const isCircuit = inst.status === 'CIRCUIT_OPEN';

                return (
                  <div key={inst.instanceName} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          isTransmitting ? 'bg-emerald-400 animate-ping' : isPacing ? 'bg-sky-400' : isDailyCap ? 'bg-amber-400' : isCircuit ? 'bg-rose-400' : 'bg-slate-500'
                        }`} />
                        <span className="font-mono font-bold text-white text-xs">{inst.instanceName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                        isTransmitting
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isPacing
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          : isDailyCap
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : isCircuit
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {inst.status}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                      <span>Phone: <span className="text-slate-200">{inst.phone || 'Connected'}</span></span>
                      <span>Lock: <span className={inst.currentTenantId ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                        {inst.currentTenantId ? 'EXCLUSIVE' : 'AVAILABLE'}
                      </span></span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span>Daily Cap: {inst.todaySent} / {inst.dailyCap}</span>
                        <span>{inst.utilizationPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            inst.utilizationPercent > 90 ? 'bg-rose-500' : inst.utilizationPercent > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, inst.utilizationPercent)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                      <span>Tenant: <span className="text-slate-300">{inst.currentTenantId || 'None'}</span></span>
                      <span>Campaign: <span className="text-slate-300">{inst.currentCampaignId ? inst.currentCampaignId.slice(0, 8) : 'Idle'}</span></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Live Console Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Terminal Title Bar */}
        <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Mac-style traffic lights */}
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>

            <span className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              dokploy@bulkflow:~# worker-logs --tail
            </span>

            {/* Live Indicator */}
            {autoRefresh && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE (3s)
              </span>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition border ${
                autoRefresh
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={autoRefresh ? 'Pause live auto-refresh' : 'Resume live auto-refresh'}
            >
              {autoRefresh ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{autoRefresh ? 'Streaming' : 'Paused'}</span>
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => fetchLogs(true)}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition disabled:opacity-50"
              title="Refresh logs immediately"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh</span>
            </button>

            {/* Copy Logs */}
            <button
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition disabled:opacity-50"
              title="Copy current visible logs to clipboard"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {/* Clear Logs */}
            <button
              onClick={handleClearLogs}
              disabled={clearing || logs.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-900/60 transition disabled:opacity-50"
              title="Clear all stored logs"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-950/60 border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Level Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-mono mr-1">Level:</span>
            {[
              { id: 'all', label: `All (${stats.totalLogs})` },
              { id: 'error', label: `Error (${stats.errorCount})`, color: 'text-rose-400' },
              { id: 'warn', label: `Warn (${stats.warnCount})`, color: 'text-amber-400' },
              { id: 'info', label: `Info (${stats.infoCount})`, color: 'text-emerald-400' },
            ].map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => setSelectedLevel(lvl.id)}
                className={`px-2.5 py-0.5 rounded-md font-mono text-[11px] transition ${
                  selectedLevel === lvl.id
                    ? 'bg-slate-800 text-white font-bold border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={lvl.color}>{lvl.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Source Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-mono">Source:</span>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Sources</option>
                <option value="worker">worker</option>
                <option value="app">app</option>
                <option value="guardrail">guardrail</option>
                <option value="evolution">evolution</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Filter logs / errors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-[11px] font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Terminal Log Output Area */}
        <div className="bg-slate-950 font-mono text-[12px] p-3 max-h-[550px] min-h-[350px] overflow-y-auto space-y-1">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
              <Terminal className="w-8 h-8 text-slate-700" />
              <p className="text-xs">No logs recorded matching current criteria.</p>
              <p className="text-[11px] text-slate-600">
                When background worker or dispatch activities run, logs stream here in real time.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isError = log.level === 'error';
              const isWarn = log.level === 'warn';
              const isExpanded = expandedLogId === log.id;
              const time = new Date(log.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });
              const relTime = getRelativeTime(log.createdAt);

              return (
                <div
                  key={log.id}
                  className={`rounded-lg transition border ${
                    isError
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                      : 'bg-slate-900/40 border-slate-800/50 text-slate-300'
                  }`}
                >
                  <div
                    onClick={() => {
                      if (log.details) {
                        setExpandedLogId(isExpanded ? null : log.id);
                      }
                    }}
                    className={`flex items-start gap-2.5 px-3 py-2 ${log.details ? 'cursor-pointer hover:bg-white/5' : ''}`}
                  >
                    {/* Timestamp */}
                    <span className="text-slate-500 text-[11px] shrink-0 select-none pt-0.5" title={log.createdAt}>
                      {time} <span className="text-[10px] text-slate-600">({relTime})</span>
                    </span>

                    {/* Badge */}
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 font-mono ${
                        isError
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {log.level}
                    </span>

                    {/* Source Tag */}
                    <span className="text-[11px] text-sky-400 shrink-0 font-semibold font-mono">
                      [{log.source}]
                    </span>

                    {/* Message */}
                    <span className="flex-1 break-words leading-relaxed font-mono text-[11.5px]">
                      {log.message}
                    </span>

                    {/* Details Dropdown Indicator */}
                    {log.details && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0 pt-0.5">
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <span>details</span>
                      </span>
                    )}
                  </div>

                  {/* Expanded Details Drawer */}
                  {isExpanded && log.details && (
                    <div className="px-4 pb-3 pt-1 border-t border-slate-800/60 bg-black/40">
                      <div className="text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                        <span>Details / Stack Trace:</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(log.details || '');
                          }}
                          className="text-[10px] text-emerald-400 hover:underline"
                        >
                          Copy Details
                        </button>
                      </div>
                      <pre className="text-[10.5px] font-mono text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80 overflow-x-auto whitespace-pre-wrap break-all leading-tight">
                        {(() => {
                          try {
                            const parsed = JSON.parse(log.details);
                            return JSON.stringify(parsed, null, 2);
                          } catch {
                            return log.details;
                          }
                        })()}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Showing {logs.length} entries (capped at 200 for browser performance)</span>
          <span>SQLite log buffer active</span>
        </div>
      </div>
    </div>
  );
}

