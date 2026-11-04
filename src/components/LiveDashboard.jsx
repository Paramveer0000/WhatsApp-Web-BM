import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  Filter, 
  Search, 
  Terminal, 
  Eye, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from '@/lib/toast';

export default function LiveDashboard({
  campaignId,
  onOpenQR,
  onNavigateWizard
}) {
  const [campaign, setCampaign] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    percentage: 0
  });

  const [logs, setLogs] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [totalRecipients, setTotalRecipients] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all'); // all, sent, failed, pending
  const [searchQuery, setSearchQuery] = useState('');
  const [jitterInfo, setJitterInfo] = useState(null); // { countdown, totalWait, nextRecipient }
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedRecipientModal, setSelectedRecipientModal] = useState(null);

  const logsEndRef = useRef(null);

  // Fetch campaign details and recipients
  useEffect(() => {
    if (campaignId) {
      loadCampaignDetails();
      loadRecipients();
    }
  }, [campaignId, statusFilter, searchQuery]);

  // Setup Server-Sent Events (SSE) listener
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      console.log('SSE connected for live updates');
    };

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.campaignId === campaignId) {
          setStats(data);
          if (data.status) {
            setCampaign(prev => prev ? { ...prev, status: data.status, halt_reason: data.haltReason } : null);
          }
        }
      } catch (err) {
        console.error('Error parsing progress SSE:', err);
      }
    });

    eventSource.addEventListener('state', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.campaignId === campaignId) {
          setCampaign(prev => prev ? { ...prev, status: data.status, halt_reason: data.reason } : null);
          if (data.status === 'completed') {
            try {
              confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
            } catch {}
          }
          loadRecipients();
        }
      } catch (err) {
        console.error('Error parsing state SSE:', err);
      }
    });

    eventSource.addEventListener('log', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.campaignId === campaignId) {
          setLogs(prev => [data, ...prev.slice(0, 150)]);
          // Reload recipients table periodically when messages send
          if (data.status === 'Sent' || data.status === 'Failed') {
            loadRecipients();
          }
        }
      } catch (err) {
        console.error('Error parsing log SSE:', err);
      }
    });

    eventSource.addEventListener('jitter', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.campaignId === campaignId) {
          setJitterInfo(data);
        }
      } catch (err) {
        console.error('Error parsing jitter SSE:', err);
      }
    });

    eventSource.addEventListener('circuit_breaker', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.campaignId === campaignId) {
          setCampaign(prev => prev ? { ...prev, status: 'paused', halt_reason: `Circuit Breaker: ${data.reason}` } : null);
        }
      } catch (err) {
        console.error('Error parsing circuit breaker SSE:', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [campaignId]);

  const loadCampaignDetails = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      const data = await res.json();
      if (data.success) {
        setCampaign(data.campaign);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load campaign:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecipients = async () => {
    try {
      let url = `/api/campaigns/${campaignId}/recipients?status=${statusFilter}&limit=100`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRecipients(data.recipients || []);
        setTotalRecipients(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to load recipients:', err);
    }
  };

  // Queue Controls
  const handleControl = async (action) => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/campaigns/${campaignId}/${action}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        loadCampaignDetails();
      }
    } catch (err) {
      toast.error(Action failed: \);
    } finally {
      setActionLoading(false);
    }
  };

  if (!campaignId) {
    return (
      <div className="p-16 text-center bg-slate-850/60 border border-slate-800 rounded-2xl flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
          <Terminal className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white">No Active Campaign Selected</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6">
          Create and launch a new bulk campaign to monitor live message dispatch and anti-ban pacing.
        </p>
        <button
          onClick={onNavigateWizard}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center gap-2 cursor-pointer"
        >
          <span>Launch New Campaign</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const isRunning = campaign?.status === 'running';
  const isPaused = campaign?.status === 'paused';
  const isCompleted = campaign?.status === 'completed';
  const isAborted = campaign?.status === 'aborted';
  const hasCircuitBreaker = Boolean(campaign?.halt_reason);

  const successRate = stats.total > 0 && stats.sent > 0
    ? Math.round((stats.sent / (stats.sent + stats.failed)) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Campaign Top Header & Controls */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">{campaign?.name || 'Loading Campaign...'}</h1>
            {/* Status Pill */}
            <div className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
              isRunning ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 animate-pulse' :
              isPaused ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
              isCompleted ? 'bg-blue-950 text-blue-300 border border-blue-500/40' :
              'bg-red-950 text-red-300 border border-red-500/40'
            }`}>
              {isRunning && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
              <span>{campaign?.status || 'Draft'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2 font-mono">
            <span>Instance: <strong className="text-emerald-400">{campaign?.instance_name}</strong></span>
            <span>&bull;</span>
            <span>Pacing: <strong>{campaign?.min_delay}s - {campaign?.max_delay}s</strong></span>
            <span>&bull;</span>
            <span>Typing Simulation: <strong>{campaign?.simulate_typing ? 'Enabled' : 'Disabled'}</strong></span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto">
          {isRunning ? (
            <button
              onClick={() => handleControl('pause')}
              disabled={actionLoading}
              className="flex-1 lg:flex-initial px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Campaign</span>
            </button>
          ) : (
            <button
              onClick={() => handleControl('resume')}
              disabled={actionLoading || isCompleted || isAborted}
              className="flex-1 lg:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isPaused ? 'Resume Campaign' : 'Start Campaign'}</span>
            </button>
          )}

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to abort this campaign? Remaining queued messages will not be sent.')) {
                handleControl('abort');
              }
            }}
            disabled={actionLoading || isCompleted || isAborted}
            className="px-3.5 py-2 bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/30 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Abort</span>
          </button>

          <a
            href={`/api/campaigns/${campaignId}/export`}
            download
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Circuit-Breaker Alert Banner */}
      {hasCircuitBreaker && (
        <div className="bg-red-950/80 border-2 border-red-500/60 rounded-2xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-900/50 text-red-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>CIRCUIT-BREAKER TRIGGERED</span>
                <span className="text-[10px] bg-red-900 text-red-200 px-2 py-0.5 rounded-full font-mono uppercase">
                  Safety Halt
                </span>
              </h3>
              <p className="text-xs text-red-200/90 mt-1 leading-relaxed">
                {campaign.halt_reason}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onOpenQR(campaign.instance_name)}
              className="flex-1 sm:flex-initial px-4 py-2 bg-red-800 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Scan QR / Reconnect
            </button>
            <button
              onClick={() => handleControl('resume')}
              className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Resume Queue
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar & KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Recipients */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Total Recipients
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Queued for campaign</div>
        </div>

        {/* Sent (Success) */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            Successfully Sent
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{stats.sent}</div>
          <div className="text-[11px] text-slate-400 mt-1">Confirmed delivered</div>
        </div>

        {/* Failed */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[11px] font-semibold text-red-400 uppercase tracking-wider mb-1">
            Failed Dispatches
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono">{stats.failed}</div>
          <div className="text-[11px] text-slate-400 mt-1">Errors logged</div>
        </div>

        {/* Skipped by Quality Gate (Not WA) */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-1">
            Quality Skipped
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{stats.skipped || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Not on WhatsApp (Protected)</div>
        </div>

        {/* Quality Health Score */}
        <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider mb-1">
            Quality Health Score
          </div>
          <div className="text-2xl font-bold text-teal-400 font-mono">{stats.qualityScore ?? 100}%</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats.percentage}% processed
          </div>
        </div>
      </div>

      {/* Progress Bar with Jitter Countdown */}
      <div className="bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Campaign Execution Progress</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">
            {stats.percentage}% ({stats.sent + stats.failed} / {stats.total})
          </span>
        </div>

        <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-800">
          <div 
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 relative"
            style={{ width: `${Math.max(stats.percentage, 2)}%` }}
          />
        </div>

        {/* Pacing Jitter Timer Card */}
        {isRunning && jitterInfo && jitterInfo.countdown > 0 && (
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs animate-pulse">
                {jitterInfo.countdown}s
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  Anti-Ban Pacing Active
                </div>
                <div className="text-[11px] text-slate-400">
                  Next message queued for <strong className="text-emerald-400 font-mono">{jitterInfo.nextRecipient?.phone || 'recipient'}</strong> in {jitterInfo.countdown} seconds...
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-mono hidden sm:block">
              Simulating human delay
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Live Logs Stream & Recipients Table Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Real-Time Event Log */}
        <div className="lg:col-span-5 bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[520px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Event Stream</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">SSE Realtime</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-1">
            {logs.length === 0 ? (
              <div className="text-slate-500 italic text-center py-16 text-xs">
                Awaiting queue dispatch events...
              </div>
            ) : (
              logs.map((log, idx) => (
                <div 
                  key={idx}
                  className={`p-2 rounded-lg border text-[11px] leading-relaxed transition ${
                    log.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-200' :
                    log.type === 'error' ? 'bg-red-950/40 border-red-500/20 text-red-200' :
                    log.type === 'warning' ? 'bg-amber-950/40 border-amber-500/20 text-amber-200' :
                    log.type === 'danger' ? 'bg-red-950/80 border-red-500/50 text-red-100 font-semibold' :
                    'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="font-semibold text-slate-300">{log.status}</span>
                    <span>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</span>
                  </div>
                  {log.phone && (
                    <div className="text-slate-400">
                      To: <strong className="text-white">{log.phone}</strong> {log.recipientName ? `(${log.recipientName})` : ''}
                    </div>
                  )}
                  {log.message && <div className="truncate">{log.message}</div>}
                  {log.error && <div className="text-red-400 font-semibold">{log.error}</div>}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Right: Interactive Recipients Data Table */}
        <div className="lg:col-span-7 bg-slate-850 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[520px]">
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              {['all', 'sent', 'failed', 'skipped', 'pending'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                    statusFilter === filter
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {filter === 'skipped' ? 'Skipped (Quality)' : filter}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phone or name..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Evaluation & Quality</th>
                  <th className="p-2.5">Phone</th>
                  <th className="p-2.5">Name</th>
                  <th className="p-2.5">Time</th>
                  <th className="p-2.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                      No recipients matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => {
                    const isSent = r.status === 'sent';
                    const isFailed = r.status === 'failed';
                    const isSending = r.status === 'sending';
                    const isSkipped = r.status === 'skipped';

                    return (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 w-max ${
                            isSent ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30' :
                            isFailed ? 'bg-red-950/80 text-red-300 border border-red-500/30' :
                            isSkipped ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30' :
                            isSending ? 'bg-blue-950/80 text-blue-300 border border-blue-500/30 animate-pulse' :
                            'bg-slate-800 text-slate-400'
                          }`}>
                            {isSent ? <CheckCircle2 className="w-2.5 h-2.5" /> :
                             isFailed ? <XCircle className="w-2.5 h-2.5" /> :
                             isSkipped ? <ShieldAlert className="w-2.5 h-2.5" /> :
                             isSending ? <Clock className="w-2.5 h-2.5" /> : null}
                            <span>{r.status}</span>
                          </span>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              r.evaluation_status === 'quality_passed' || r.evaluation_status === 'verified_wa'
                                ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/30' :
                              r.evaluation_status === 'not_wa'
                                ? 'bg-amber-950/90 text-amber-300 border border-amber-500/30' :
                              r.evaluation_status === 'spam_flagged'
                                ? 'bg-red-950/90 text-red-300 border border-red-500/30' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {r.evaluation_status === 'quality_passed' ? 'Quality Passed' :
                               r.evaluation_status === 'not_wa' ? 'Not on WA' :
                               r.evaluation_status === 'spam_flagged' ? 'Spam Alert' :
                               r.evaluation_status === 'circuit_failed' ? 'Circuit Halted' :
                               r.evaluation_status || 'Pending Eval'}
                            </span>
                            {r.quality_score !== null && r.quality_score !== undefined && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {r.quality_score}pts
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 font-mono text-emerald-400 font-medium">
                          {r.phone}
                        </td>
                        <td className="p-2.5 text-slate-200">
                          {r.name || '<empty>'}
                        </td>
                        <td className="p-2.5 text-slate-400 text-[11px] font-mono">
                          {r.sent_at ? new Date(r.sent_at).toLocaleTimeString() : '-'}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => setSelectedRecipientModal(r)}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                            title="Inspect Task Quality & Dispatch Payload"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-2 text-[11px] text-slate-500 text-right">
            Showing {recipients.length} of {totalRecipients} entries
          </div>
        </div>
      </div>

      {/* Recipient Details Inspection Modal */}
      {selectedRecipientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Recipient Dispatch Inspection</h3>
              <button
                onClick={() => setSelectedRecipientModal(null)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Phone:</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedRecipientModal.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Task Status:</span>
                  <span className="font-bold capitalize">{selectedRecipientModal.status}</span>
                </div>
              </div>

              {/* Evaluation & Quality Audit Details */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Evaluation & Quality Audit:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                      {selectedRecipientModal.evaluation_status || 'unverified'}
                    </span>
                    <span className="font-mono text-emerald-400 font-bold text-xs">
                      {selectedRecipientModal.quality_score ?? 100} / 100
                    </span>
                  </div>
                </div>
                {selectedRecipientModal.quality_notes && (
                  <div className="text-slate-400 text-[11px] leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    {selectedRecipientModal.quality_notes}
                  </div>
                )}
              </div>

              {selectedRecipientModal.error && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200">
                  <div className="font-semibold mb-1">Error Details:</div>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap">{selectedRecipientModal.error}</pre>
                </div>
              )}

              <div>
                <span className="text-slate-400 block text-[10px] uppercase mb-1">Rendered Message Body:</span>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 whitespace-pre-wrap font-sans text-slate-200">
                  {selectedRecipientModal.rendered_message || '<Not rendered yet>'}
                </div>
              </div>

              {selectedRecipientModal.response_data && (
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase mb-1">Evolution API Response:</span>
                  <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] text-slate-400 font-mono overflow-x-auto max-h-32">
                    {selectedRecipientModal.response_data}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

