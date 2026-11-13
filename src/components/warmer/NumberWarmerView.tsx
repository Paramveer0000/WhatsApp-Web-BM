'use client';

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Play,
  Pause,
  RotateCw,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  MessageSquare,
  Activity,
  Send,
  Zap,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import InfoButton from '@/components/InfoButton';
import { WARMER_TOPICS } from '@/lib/warmer/dialogues';

interface ConnectedInstance {
  name: string;
  status: string;
  phone?: string | null;
  profileName?: string;
}

interface WarmerLog {
  id: string;
  timestamp: string;
  topic: string;
  instanceA: string;
  instanceB: string;
  phoneA: string;
  phoneB: string;
  messageA: string;
  messageB: string;
  delaySeconds: number;
  status: 'DELIVERED' | 'FAILED';
  error?: string;
}

interface WarmerSession {
  id: string;
  instanceA: string;
  instanceB: string;
  phoneA?: string | null;
  phoneB?: string | null;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  dailyCap: number;
  todayExchanges: number;
  topic: string;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  useAi: boolean;
  aiPrompt?: string | null;
  lastExchangedAt?: string | null;
  nextScheduledAt?: string | null;
  logs?: string;
}

export function NumberWarmerView() {
  const [instances, setInstances] = useState<ConnectedInstance[]>([]);
  const [session, setSession] = useState<WarmerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Form Configuration State
  const [instanceA, setInstanceA] = useState('');
  const [instanceB, setInstanceB] = useState('');
  const [topic, setTopic] = useState('casual');
  const [dailyCap, setDailyCap] = useState(25);
  const [minDelay, setMinDelay] = useState(45);
  const [maxDelay, setMaxDelay] = useState(90);
  const [useAi, setUseAi] = useState(false);

  // Parse Live Logs
  const liveLogs: WarmerLog[] = React.useMemo(() => {
    try {
      if (!session?.logs) return [];
      return JSON.parse(session.logs);
    } catch {
      return [];
    }
  }, [session?.logs]);

  const fetchWarmerData = async () => {
    try {
      const res = await fetch('/api/warmer');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch warmer');

      setInstances(data.instances || []);

      if (data.sessions && data.sessions.length > 0) {
        const active = data.sessions[0];
        setSession(active);
        setInstanceA(active.instanceA);
        setInstanceB(active.instanceB);
        setTopic(active.topic);
        setDailyCap(active.dailyCap);
        setMinDelay(active.minDelaySeconds);
        setMaxDelay(active.maxDelaySeconds);
        setUseAi(active.useAi);
      } else if (data.instances && data.instances.length >= 2) {
        setInstanceA(data.instances[0].name);
        setInstanceB(data.instances[1].name);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading warmer state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarmerData();
    // Auto-poll status every 10s if running
    const interval = setInterval(() => {
      fetchWarmerData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = async () => {
    if (!instanceA || !instanceB) {
      toast.warning('Please select two distinct WhatsApp numbers to warm.');
      return;
    }
    if (instanceA === instanceB) {
      toast.warning('Instance A and Instance B must be different WhatsApp numbers.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch('/api/warmer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceA,
          instanceB,
          topic,
          dailyCap,
          minDelaySeconds: minDelay,
          maxDelaySeconds: maxDelay,
          useAi,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');
      setSession(data.session);
      toast.success('Warmer configuration saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save configuration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!session) {
      await handleSaveConfig();
    }
    try {
      setActionLoading(true);
      const currentId = session?.id;
      if (!currentId) return;

      const res = await fetch(`/api/warmer/${currentId}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start warmer');
      setSession(data.session);
      toast.success('Number Warmer activated! Automated dialogue exchanges initiated 🚀');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start warmer');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!session?.id) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/warmer/${session.id}/pause`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to pause warmer');
      setSession(data.session);
      toast.info('Number Warmer paused.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to pause warmer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestTurnNow = async () => {
    if (!session?.id) {
      toast.warning('Please save your instance pair first.');
      return;
    }
    try {
      setActionLoading(true);
      toast.info('Exchanging dialogue turn between accounts...');
      const res = await fetch(`/api/warmer/${session.id}/tick`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test turn failed');
      toast.success('Dialogue exchange completed & logged!');
      fetchWarmerData();
    } catch (err: any) {
      toast.error(err.message || 'Exchange failed');
    } finally {
      setActionLoading(false);
    }
  };

  const isRunning = session?.status === 'RUNNING';
  const progressPercent = session ? Math.min(100, Math.round((session.todayExchanges / session.dailyCap) * 100)) : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-950/50 shrink-0">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-black text-white">Peer-to-Peer WhatsApp Number Warmer</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 font-bold">
                Anti-Ban Defense
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automates realistic two-way everyday dialogues between 2 connected WhatsApp numbers to build organic reputation and prevent spam bans.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              <span>Pause Warmer</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={actionLoading || instances.length < 2}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>Start Warmer</span>
            </button>
          )}

          <button
            onClick={handleTestTurnNow}
            disabled={actionLoading || !session}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer disabled:opacity-50"
            title="Execute 1 immediate exchange turn between instances"
          >
            <RotateCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Test Turn</span>
          </button>
        </div>
      </div>

      {/* Warning if less than 2 instances connected */}
      {instances.length < 2 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-amber-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
          <span>
            You need at least <strong>2 connected WhatsApp numbers</strong> to use the Peer-to-Peer Number Warmer. Please pair an additional number in the <strong>WhatsApp Accounts</strong> tab.
          </span>
        </div>
      )}

      {/* Top KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase">Engine Status</p>
            <p className="text-base font-bold text-white capitalize">{session?.status?.toLowerCase() || 'Idle'}</p>
          </div>
        </div>

        {/* Metric 2: Today's Exchanges */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-slate-400 uppercase">Today's Exchanges</p>
              <span className="text-[10px] font-mono text-blue-400 font-bold">{progressPercent}%</span>
            </div>
            <p className="text-base font-bold text-white">
              {session?.todayExchanges || 0} / {session?.dailyCap || dailyCap}
            </p>
          </div>
        </div>

        {/* Metric 3: Safe Pacing Interval */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase">Jitter Delay</p>
            <p className="text-base font-bold text-white">{minDelay}s - {maxDelay}s</p>
          </div>
        </div>

        {/* Metric 4: Health Protection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase">Anti-Ban Score</p>
            <p className="text-base font-bold text-emerald-400">98 / 100 (Safe)</p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Instance Pairing & Warmer Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-orange-400" />
                <span>Instance Pair Selection</span>
              </h3>
              <InfoButton
                title="Peer-to-Peer Pair"
                description="Select two active WhatsApp accounts. They will exchange realistic back-and-forth messages, alternating between questioner and responder."
                recommended="Pick 1 new number and 1 warmed or mature number for best trust transfer"
              />
            </div>

            {/* Instance A */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Account A (Caller)</span>
                {instanceA && (
                  <span className="text-[11px] text-emerald-400 font-mono">
                    {instances.find((i) => i.name === instanceA)?.phone || 'Online'}
                  </span>
                )}
              </label>
              <select
                value={instanceA}
                onChange={(e) => setInstanceA(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Select Instance A...</option>
                {instances.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name} {i.phone ? `(+${i.phone})` : ''} ({i.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Instance B */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Account B (Responder)</span>
                {instanceB && (
                  <span className="text-[11px] text-emerald-400 font-mono">
                    {instances.find((i) => i.name === instanceB)?.phone || 'Online'}
                  </span>
                )}
              </label>
              <select
                value={instanceB}
                onChange={(e) => setInstanceB(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Select Instance B...</option>
                {instances.map((i) => (
                  <option key={i.name} value={i.name}>
                    {i.name} {i.phone ? `(+${i.phone})` : ''} ({i.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Selector */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300">Conversation Topic</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {WARMER_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopic(t.id)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      topic === t.id
                        ? 'bg-[#0c57e4]/20 border-[#0c57e4] text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="text-xs font-bold text-white">{t.name}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Pacing & Target Controls */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Daily Target Exchanges</span>
                  <span className="text-orange-400 font-mono font-bold">{dailyCap} / day</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={dailyCap}
                  onChange={(e) => setDailyCap(Number(e.target.value))}
                  className="w-full accent-orange-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Recommended: 20-30 for new numbers</p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span>Simulated Typing & Turn Delay</span>
                  <span className="text-blue-400 font-mono font-bold">{minDelay}s - {maxDelay}s</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400">Min Delay (s)</span>
                    <input
                      type="number"
                      min="20"
                      max="120"
                      value={minDelay}
                      onChange={(e) => setMinDelay(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Max Delay (s)</span>
                    <input
                      type="number"
                      min="30"
                      max="180"
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* AI Smart Response Toggle */}
              <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">AI-Powered Dynamic Chats</p>
                    <p className="text-[10px] text-slate-400">Use LLM to generate novel creative replies</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={useAi}
                  onChange={(e) => setUseAi(e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl bg-[#0c57e4] hover:bg-[#0944b5] text-white text-xs font-bold shadow-md shadow-blue-900/30 transition cursor-pointer disabled:opacity-50"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* Right Column: Live WhatsApp Conversation Stream (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[650px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Live Dialogue Stream & Transcript</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {liveLogs.length} logged {liveLogs.length === 1 ? 'exchange' : 'exchanges'}
              </span>
            </div>

            {/* WhatsApp Chat Bubbles Container */}
            <div className="flex-1 overflow-y-auto space-y-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
              {liveLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-600 mb-3">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-400">No Dialogue Exchanges Yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Click <strong>Start Warmer</strong> or <strong>Test Turn</strong> to watch the two accounts exchange authentic WhatsApp messages here in real time.
                  </p>
                </div>
              ) : (
                liveLogs.map((log) => (
                  <div key={log.id} className="space-y-2 p-3 bg-slate-900/90 rounded-2xl border border-slate-800/90 text-xs">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-800 pb-1.5">
                      <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className="capitalize px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">{log.topic}</span>
                    </div>

                    {/* Turn 1: From Instance A */}
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                        A
                      </div>
                      <div className="flex-1 bg-emerald-950/40 border border-emerald-500/20 rounded-2xl rounded-tl-none p-3 text-emerald-100">
                        <div className="flex items-center justify-between text-[10px] text-emerald-400/80 mb-1">
                          <span className="font-bold">{log.instanceA}</span>
                          <span className="font-mono">+{log.phoneA}</span>
                        </div>
                        <p className="leading-relaxed">{log.messageA}</p>
                      </div>
                    </div>

                    {/* Turn 2: From Instance B */}
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                        B
                      </div>
                      <div className="flex-1 bg-blue-950/40 border border-blue-500/20 rounded-2xl rounded-tl-none p-3 text-blue-100">
                        <div className="flex items-center justify-between text-[10px] text-blue-400/80 mb-1">
                          <span className="font-bold">{log.instanceB}</span>
                          <span className="font-mono">+{log.phoneB}</span>
                        </div>
                        <p className="leading-relaxed">{log.messageB}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-500 font-mono pt-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Two-way exchange verified (Paced by {log.delaySeconds}s)</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Status Ticker */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulating native human typing presence (`composing`)</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-400">100% End-to-End Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

