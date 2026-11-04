'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  BrainCircuit,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Send,
  MessageSquare,
  HelpCircle,
  Sliders,
  ChevronRight,
  Activity,
  Calendar,
  Lock,
  Zap,
} from 'lucide-react';
import { GuardrailConfig } from '@/lib/guardrails/types';

interface AiGuardrailAdvisorTabProps {
  scope: 'global' | 'instance' | 'campaign';
  scopeId: string;
  currentConfig: GuardrailConfig;
  onApplyDraft: (draftConfig: GuardrailConfig, notes: string) => void;
}

export function AiGuardrailAdvisorTab({
  scope,
  scopeId,
  currentConfig,
  onApplyDraft,
}: AiGuardrailAdvisorTabProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [latestRun, setLatestRun] = useState<any>(null);
  const [runsList, setRunsList] = useState<any[]>([]);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);

  // Analysis options
  const [windowDays, setWindowDays] = useState(7);
  const [goal, setGoal] = useState('Balance throughput and risk');
  const [notes, setNotes] = useState('');

  // Selected recommendations for apply
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);
  const [applyingDraft, setApplyingDraft] = useState(false);

  // Interactive chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  useEffect(() => {
    loadRuns();
  }, [scope, scopeId]);

  const loadRuns = async () => {
    try {
      const res = await fetch(`/api/v1/advisor/runs?scope=${scope}&limit=5`);
      const data = await res.json();
      if (data?.runs && data.runs.length > 0) {
        setRunsList(data.runs);
        setLatestRun(data.runs[0]);
        // Default select all pending recommendations
        const pending = (data.runs[0].recommendations || []).map((r: any) => r.id);
        setSelectedRecIds(pending);
      }
    } catch {}
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/v1/advisor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          scopeId,
          windowDays,
          goal,
          notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysisModalOpen(false);
        await loadRuns();
      } else {
        alert(data.error || 'Analysis failed');
      }
    } catch (e: any) {
      alert(`Error running advisor analysis: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSelectRec = (id: string) => {
    setSelectedRecIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplySelected = async () => {
    if (!latestRun) return;
    setApplyingDraft(true);
    try {
      const res = await fetch(`/api/v1/advisor/runs/${latestRun.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationIds: selectedRecIds,
        }),
      });
      const data = await res.json();
      if (data.success && data.draftConfig) {
        onApplyDraft(data.draftConfig, `Applied ${data.appliedCount} AI Advisor recommendations`);
      } else {
        alert(data.error || 'Failed to generate draft configuration');
      }
    } catch (e: any) {
      alert(`Apply failed: ${e.message}`);
    } finally {
      setApplyingDraft(false);
    }
  };

  const handleSendChat = async () => {
    if (!inputQuestion.trim() || !latestRun || sendingChat) return;
    const q = inputQuestion.trim();
    setInputQuestion('');
    const newHistory = [...chatMessages, { role: 'user' as const, content: q }];
    setChatMessages(newHistory);
    setSendingChat(true);

    try {
      const res = await fetch(`/api/v1/advisor/runs/${latestRun.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          history: chatMessages,
        }),
      });
      const data = await res.json();
      if (data.success && data.reply) {
        setChatMessages([...newHistory, { role: 'assistant', content: data.reply }]);
      } else {
        setChatMessages([...newHistory, { role: 'assistant', content: `Error: ${data.error || 'Failed to get answer'}` }]);
      }
    } catch (e: any) {
      setChatMessages([...newHistory, { role: 'assistant', content: `Network error: ${e.message}` }]);
    } finally {
      setSendingChat(false);
    }
  };

  let parsedOutput: any = null;
  if (latestRun?.output) {
    try {
      parsedOutput = JSON.parse(latestRun.output);
    } catch {}
  }
  const healthRating = parsedOutput?.overall_assessment?.health || 'good';
  const healthSummary = parsedOutput?.overall_assessment?.summary || 'Operations are stable.';
  const confidence = parsedOutput?.overall_assessment?.confidence || 'medium';
  const keyFindings = parsedOutput?.key_findings || [];
  const experiments = parsedOutput?.suggested_experiments || [];

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-teal-950/40 border border-teal-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <Sparkles className="w-3.5 h-3.5" />
                AI Deliverability & Anti-Ban Advisor
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Model: {latestRun?.modelUsed || 'Hybrid Engine (Deterministic + OpenRouter)'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Evidence-Based Guardrail Optimization
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Synthesizes real-world sending volume, delivery delays, circuit breaker trips, and WhatsApp rate-limit events into concrete, clamped parameter recommendations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAnalysisModalOpen(true)}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-950/50 transition cursor-pointer"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>{analyzing ? 'Analyzing Data...' : 'Analyze Sending Data'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Analysis Display */}
      {latestRun ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Health Card & Key Findings */}
          <div className="space-y-6">
            {/* Health Status */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Health Assessment
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase font-mono ${
                    healthRating === 'good'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : healthRating === 'watch'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {healthRating} Risk
                </span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {healthSummary}
              </p>

              <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Confidence</span>
                  <p className="font-mono text-emerald-400 font-bold capitalize">{confidence}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Observed Window</span>
                  <p className="font-mono text-slate-200 font-bold">{latestRun.windowDays} Days</p>
                </div>
              </div>
            </div>

            {/* Key Findings */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                Key Findings ({keyFindings.length})
              </span>

              <div className="space-y-2.5">
                {keyFindings.map((f: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          f.severity === 'critical'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : f.severity === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                        }`}
                      >
                        {f.severity}
                      </span>
                    </div>
                    <p className="text-slate-200 leading-snug">{f.finding}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Chat Launcher */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-teal-400" />
                  Ask Advisor a Question
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Clarify trade-offs or rationale with the AI.
                </p>
              </div>
              <button
                onClick={() => setChatOpen(!chatOpen)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition"
              >
                {chatOpen ? 'Close Chat' : 'Open Q&A'}
              </button>
            </div>
          </div>

          {/* Right 2 Columns: Recommendations Table & Action Strip */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    Recommended Adjustments ({latestRun.recommendations?.length || 0})
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Select recommendations to test or apply as draft parameters.
                  </p>
                </div>

                <button
                  onClick={handleApplySelected}
                  disabled={selectedRecIds.length === 0 || applyingDraft}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow ${
                    selectedRecIds.length > 0 && !applyingDraft
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-950/40'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {applyingDraft ? 'Applying...' : `Apply Selected (${selectedRecIds.length}) as Draft`}
                  </span>
                </button>
              </div>

              {/* Recommendations Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Select</th>
                      <th className="py-2.5 px-3">Parameter</th>
                      <th className="py-2.5 px-3">Current</th>
                      <th className="py-2.5 px-3">Suggested</th>
                      <th className="py-2.5 px-3">Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {(latestRun.recommendations || []).map((rec: any) => {
                      const isSelected = selectedRecIds.includes(rec.id);
                      return (
                        <tr
                          key={rec.id}
                          className={`hover:bg-slate-850/50 transition ${
                            isSelected ? 'bg-teal-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRec(rec.id)}
                              className="rounded border-slate-700 text-teal-500 focus:ring-teal-500 h-4 w-4"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-slate-200 font-bold block">
                              {rec.fieldPath}
                            </span>
                            <span className="text-[10px] font-mono text-teal-400 capitalize">
                              {rec.section}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-400">
                            {rec.currentValue}
                          </td>
                          <td className="py-3 px-3 font-mono text-emerald-400 font-bold">
                            {rec.suggestedValue}
                          </td>
                          <td className="py-3 px-3 max-w-xs text-slate-300 text-[11px] leading-relaxed">
                            {rec.rationale}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chat Drawer */}
            {chatOpen && (
              <div className="p-5 rounded-2xl bg-slate-900 border border-teal-500/30 space-y-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Bot className="w-4 h-4 text-teal-400" />
                    Deliverability Advisor Q&A Session
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Zero PII Shared (Aggregates Only)
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                  {chatMessages.length === 0 ? (
                    <p className="text-slate-500 text-center py-4 italic">
                      Ask any question about this audit, suggested delays, or warm-up pacing.
                    </p>
                  ) : (
                    chatMessages.map((m, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl ${
                          m.role === 'user'
                            ? 'bg-teal-950/40 border border-teal-500/20 text-teal-100 ml-6'
                            : 'bg-slate-900 border border-slate-800 text-slate-200 mr-6'
                        }`}
                      >
                        <span className="text-[10px] font-mono font-bold block mb-1 text-slate-400 capitalize">
                          {m.role === 'user' ? 'Operator' : 'AI Advisor'}
                        </span>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputQuestion}
                    onChange={(e) => setInputQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="e.g. Why should I increase min delay from 12s to 18s?"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={sendingChat || !inputQuestion.trim()}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <BrainCircuit className="w-10 h-10 text-teal-400 mx-auto opacity-70" />
          <h3 className="text-sm font-bold text-white">No Advisor Runs Recorded</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click "Analyze Sending Data" above to synthesize your recent dispatches and generate tailored anti-ban safety parameters.
          </p>
        </div>
      )}

      {/* Analysis Modal */}
      {analysisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              Analyze Dispatch History
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Observation Window</label>
                <select
                  value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                >
                  <option value={7}>Last 7 Days (Recommended)</option>
                  <option value={14}>Last 14 Days</option>
                  <option value={30}>Last 30 Days (Comprehensive)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Optimization Goal</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                >
                  <option value="Balance throughput and risk">Balance throughput and risk (Recommended)</option>
                  <option value="Minimize ban risk (defensive)">Minimize ban risk (Defensive)</option>
                  <option value="Maximize throughput within safe limits">Maximize throughput within safe limits</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Context Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Recently warmed up number; sending to existing customer opt-in leads..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-teal-950/30 border border-teal-500/20 text-[11px] text-teal-200">
                🔒 <strong>Privacy Guarantee:</strong> Only aggregated metrics (delivery rate, failure counts, delay medians) are evaluated. No phone numbers, recipient names, or raw messages leave your server.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setAnalysisModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRunAnalysis}
                disabled={analyzing}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg transition"
              >
                {analyzing ? 'Analyzing...' : 'Start Audit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
