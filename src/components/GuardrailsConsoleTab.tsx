'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Sliders, 
  Clock, 
  Zap, 
  Send, 
  RotateCcw, 
  Download, 
  Upload, 
  Check, 
  X, 
  RefreshCw, 
  History, 
  Activity, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Lock, 
  Play, 
  CheckCircle2, 
  Save, 
  Sparkles, 
  HelpCircle,
  Eye,
  Calendar,
  AlertCircle,
  FileText
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { 
  GuardrailConfig, 
  GUARDRAIL_PRESETS, 
  calculateRiskScore, 
  RiskFactor, 
  simulatePacing, 
  SimulationResult 
} from '@/lib/guardrails';
import { AiGuardrailAdvisorTab } from '@/components/AiGuardrailAdvisorTab';

export function GuardrailsConsoleTab() {
  // Navigation & Scope State
  const [activeTab, setActiveTab] = useState<'config' | 'activity' | 'versions' | 'advisor'>('config');
  const [scope, setScope] = useState<'global' | 'instance' | 'campaign'>('global');
  const [scopeId, setScopeId] = useState('');
  const [instances, setInstances] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Config & Form State
  const [currentConfig, setCurrentConfig] = useState<GuardrailConfig>(GUARDRAIL_PRESETS['safe'].config);
  const [originalConfig, setOriginalConfig] = useState<GuardrailConfig>(GUARDRAIL_PRESETS['safe'].config);
  const [selectedPreset, setSelectedPreset] = useState<string>('safe');
  const [strictMode, setStrictMode] = useState(false);
  const [version, setVersion] = useState(1);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<'ADMIN' | 'OPERATOR'>('ADMIN');

  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showOverriddenOnly, setShowOverriddenOnly] = useState(false);
  const [diffDrawerOpen, setDiffDrawerOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Simulator State
  const [simRecipients, setSimRecipients] = useState(500);
  const [simStartTime, setSimStartTime] = useState(new Date().toISOString().slice(0, 16));
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [runningSim, setRunningSim] = useState(false);

  // Activity & Version History
  const [events, setEvents] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);

  // Calculate live client-side risk score instantly
  const riskAnalysis = useMemo(() => {
    return calculateRiskScore(currentConfig);
  }, [currentConfig]);

  // Track dirty changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(currentConfig) !== JSON.stringify(originalConfig);
  }, [currentConfig, originalConfig]);

  // Load instances, campaigns, and guardrail settings
  useEffect(() => {
    fetch('/api/evolution/instances')
      .then((r) => r.json())
      .then((d) => d.instances && setInstances(d.instances))
      .catch(() => {});

    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => d.campaigns && setCampaigns(d.campaigns))
      .catch(() => {});

    loadGuardrails(scope, scopeId);
  }, []);

  const loadGuardrails = async (newScope: 'global' | 'instance' | 'campaign', newScopeId: string) => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ scope: newScope, scopeId: newScopeId });
      const res = await fetch(`/api/v1/guardrails?${q.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCurrentConfig(data.profile.config);
        setOriginalConfig(data.profile.config);
        setStrictMode(data.profile.strictMode);
        setVersion(data.profile.version);
        setSelectedPreset(data.profile.presetKey || 'custom');
        setSources(data.sources || {});
        setUserRole(data.role || 'ADMIN');
      }
    } catch (err) {
      console.error('Failed to load guardrails', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    if (presetKey === 'custom') {
      setSelectedPreset('custom');
      return;
    }
    const preset = GUARDRAIL_PRESETS[presetKey];
    if (preset) {
      setSelectedPreset(presetKey);
      setCurrentConfig(JSON.parse(JSON.stringify(preset.config)));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/guardrails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          scopeId,
          config: currentConfig,
          strictMode,
          version,
          presetKey: selectedPreset,
          diffSummary: `Updated ${diffs.length} parameters`,
        }),
      });

      let data: any = {};
      const responseText = await res.text();
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseErr) {
        data = { error: responseText || `HTTP ${res.status}: ${res.statusText}` };
      }

      if (res.ok && data.success) {
        setOriginalConfig(JSON.parse(JSON.stringify(currentConfig)));
        setVersion(data.version);
        setDiffDrawerOpen(false);
        setSaveSuccessMsg('Guardrails successfully applied & saved!');
        toast.success('Guardrails successfully applied & saved!', 'Guardrails Saved');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      } else {
        toast.error(data.error || `Failed to save guardrails (${res.status})`, 'Save Error');
      }
    } catch (err: any) {
      toast.error(`Save error: ${err.message}`, 'Save Error');
    } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async () => {
    setRunningSim(true);
    try {
      const res = await fetch('/api/v1/guardrails/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: currentConfig,
          totalRecipients: simRecipients,
          startTime: simStartTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSimResult(data.simulation);
        toast.success('Guardrails pacing simulation completed!', 'Simulation Ready');
      } else {
        toast.error(data.error || 'Simulation failed', 'Simulation Error');
      }
    } catch (err: any) {
      toast.error(`Simulation failed: ${err.message}`, 'Simulation Error');
    } finally {
      setRunningSim(false);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/v1/guardrails/events?limit=30');
      const data = await res.json();
      if (data.success) setEvents(data.events);
    } catch {}
  };

  const loadVersions = async () => {
    try {
      const q = new URLSearchParams({ scope, scopeId });
      const res = await fetch(`/api/v1/guardrails/versions?${q.toString()}`);
      const data = await res.json();
      if (data.success) setVersions(data.versions);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'activity') loadEvents();
    if (activeTab === 'versions') loadVersions();
  }, [activeTab]);

  const handleRestoreVersion = async (verNum: number) => {
    if (!confirm(`Are you sure you want to restore Version ${verNum}?`)) return;
    try {
      const res = await fetch(`/api/v1/guardrails/versions/${verNum}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, scopeId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadGuardrails(scope, scopeId);
        setActiveTab('config');
        toast.success(`Successfully rolled back to Version ${verNum}`, 'Version Restored');
      } else {
        toast.error(data.error || 'Restore failed', 'Restore Error');
      }
    } catch (e: any) {
      toast.error(e.message, 'Restore Error');
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `guardrail-${scope}-${scopeId || 'global'}-v${version}.json`);
    dl.click();
    toast.success('Guardrails JSON exported successfully!');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        setCurrentConfig(parsed);
        setSelectedPreset('custom');
        toast.success('Guardrails configuration loaded into editor. Review and click Save Changes to persist.', 'Config Imported');
      } catch (err: any) {
        toast.error('Invalid JSON guardrails file: ' + err.message, 'Import Error');
      }
    };
    reader.readAsText(file);
  };

  // Diff calculation
  const diffs = useMemo(() => {
    const list: Array<{ path: string; oldVal: any; newVal: any }> = [];
    const traverse = (o: any, c: any, prefix = '') => {
      for (const k in c) {
        const currentPath = prefix ? `${prefix}.${k}` : k;
        if (typeof c[k] === 'object' && c[k] !== null && !Array.isArray(c[k])) {
          traverse(o ? o[k] : undefined, c[k], currentPath);
        } else {
          const oldV = o ? o[k] : undefined;
          const newV = c[k];
          if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
            list.push({ path: currentPath, oldVal: oldV, newVal: newV });
          }
        }
      }
    };
    traverse(originalConfig, currentConfig);
    return list;
  }, [originalConfig, currentConfig]);

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="flex items-center gap-3 text-emerald-400 font-mono text-sm">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading Anti-Ban Guardrails Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Strip with Scope Selector and Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h1 className="text-base font-bold text-white tracking-tight">Anti-Ban Guardrails</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
              v{version}
            </span>
            {userRole === 'OPERATOR' && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                Read-Only (Operator)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Precision dispatch safety, pacing curves & anti-detection controls</p>
        </div>

        {/* Scope Selector & Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => {
                setScope('global');
                setScopeId('');
                loadGuardrails('global', '');
              }}
              className={`px-2.5 py-1 rounded-lg transition ${
                scope === 'global' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Global
            </button>
            <button
              onClick={() => {
                setScope('instance');
                const firstId = instances[0]?.name || '';
                setScopeId(firstId);
                loadGuardrails('instance', firstId);
              }}
              className={`px-2.5 py-1 rounded-lg transition ${
                scope === 'instance' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Instance
            </button>
            <button
              onClick={() => {
                setScope('campaign');
                const firstId = campaigns[0]?.id || '';
                setScopeId(firstId);
                loadGuardrails('campaign', firstId);
              }}
              className={`px-2.5 py-1 rounded-lg transition ${
                scope === 'campaign' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Campaign
            </button>
          </div>

          {scope === 'instance' && (
            <select
              value={scopeId}
              onChange={(e) => {
                setScopeId(e.target.value);
                loadGuardrails('instance', e.target.value);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.name}>
                  {inst.name}
                </option>
              ))}
            </select>
          )}

          {scope === 'campaign' && (
            <select
              value={scopeId}
              onChange={(e) => {
                setScopeId(e.target.value);
                loadGuardrails('campaign', e.target.value);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Sub-Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('config')}
              className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'config' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveTab('advisor')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                activeTab === 'advisor'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold shadow-sm'
                  : 'text-teal-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Advisor</span>
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'activity' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Activity
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'versions' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
            >
              Versions
            </button>
          </div>

          {/* Save Button */}
          {userRole === 'ADMIN' && (
            <button
              onClick={() => setDiffDrawerOpen(true)}
              disabled={!hasUnsavedChanges || saving}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition shadow ${
                hasUnsavedChanges
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-950/40'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center justify-between">
          <span>✓ {saveSuccessMsg}</span>
          <button onClick={() => setSaveSuccessMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 2. Security Preset Configurations */}
      {activeTab === 'config' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Security Preset Configurations
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition"
              >
                <Download className="w-3 h-3" />
                <span>Export JSON</span>
              </button>
              <label className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 cursor-pointer transition">
                <Upload className="w-3 h-3" />
                <span>Import</span>
                <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              {
                id: 'ultra-safe',
                name: 'Ultra Safe',
                desc: 'Maximum protection for newly created WhatsApp numbers, unverified business lines, or numbers with prior flags.',
              },
              {
                id: 'safe',
                name: 'Safe (Recommended)',
                desc: 'Engineered for business accounts with regular customer opt-in contacts and moderate daily volumes.',
              },
              {
                id: 'balanced',
                name: 'Balanced',
                desc: 'Higher throughput for verified numbers with strong existing engagement history.',
              },
              {
                id: 'aggressive',
                name: 'Aggressive (High Risk)',
                desc: 'Fast dispatch for urgent transactional broadcasts to confirmed opt-in numbers.',
              },
              {
                id: 'custom',
                name: 'Custom',
                desc: 'Manual overrides customized for your account.',
              },
            ].map((p) => {
              const isSelected = selectedPreset === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-950/30'
                      : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-white tracking-tight">{p.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Main Form & Live Safety Simulator */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: 10 Config Sections */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search Filter Bar */}
            <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search guardrail parameters..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={strictMode}
                  onChange={(e) => setStrictMode(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Strict Mode</span>
              </label>
            </div>

            {/* Pacing Curve Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white">2.1 Message Pacing & Human Delay Curves</h4>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  {currentConfig.pacing.distribution}
                </span>
              </div>
              <p className="text-xs text-slate-400">Jitter interval distribution, natural pauses, and presence simulation</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Min Delay</span>
                    <span className="font-mono text-emerald-400 font-bold">{currentConfig.pacing.minDelay}s</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={currentConfig.pacing.minDelay}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setCurrentConfig({
                        ...currentConfig,
                        pacing: { ...currentConfig.pacing, minDelay: Number(e.target.value) },
                      });
                    }}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Max Delay</span>
                    <span className="font-mono text-emerald-400 font-bold">{currentConfig.pacing.maxDelay}s</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    value={currentConfig.pacing.maxDelay}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setCurrentConfig({
                        ...currentConfig,
                        pacing: { ...currentConfig.pacing, maxDelay: Number(e.target.value) },
                      });
                    }}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="text-xs text-slate-400 block mb-1">Interval Distribution Algorithm</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {(['uniform', 'triangular', 'log-normal'] as const).map((dist) => (
                    <button
                      key={dist}
                      type="button"
                      onClick={() => {
                        setSelectedPreset('custom');
                        setCurrentConfig({
                          ...currentConfig,
                          pacing: { ...currentConfig.pacing, distribution: dist },
                        });
                      }}
                      className={`p-2 rounded-xl border text-center capitalize transition ${
                        currentConfig.pacing.distribution === dist
                          ? 'bg-emerald-950/30 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {dist === 'log-normal' ? 'Log-Normal (Human)' : dist}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/80">
                <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentConfig.pacing.humanPause.enabled}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setCurrentConfig({
                        ...currentConfig,
                        pacing: {
                          ...currentConfig.pacing,
                          humanPause: { ...currentConfig.pacing.humanPause, enabled: e.target.checked },
                        },
                      });
                    }}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <span className="font-bold block">Random Human Pause</span>
                    <span className="text-[11px] text-slate-400">
                      {currentConfig.pacing.humanPause.probabilityPercent}% chance of a 30-90s pause
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentConfig.pacing.typingSimulation.enabled}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setCurrentConfig({
                        ...currentConfig,
                        pacing: {
                          ...currentConfig.pacing,
                          typingSimulation: { ...currentConfig.pacing.typingSimulation, enabled: e.target.checked },
                        },
                      });
                    }}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <span className="font-bold block">Typing Simulation</span>
                    <span className="text-[11px] text-slate-400">
                      Sends &quot;composing...&quot; status 40ms per character
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Batch Cooldown & Windows */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">2.2 Batch Cooldowns & Sending Windows</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Batch Size Trigger</span>
                    <span className="font-mono text-emerald-400 font-bold">{currentConfig.batchCooldown.batchSizeMax} msgs</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={currentConfig.batchCooldown.batchSizeMax}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setCurrentConfig({
                        ...currentConfig,
                        batchCooldown: { ...currentConfig.batchCooldown, batchSizeMax: Number(e.target.value) },
                      });
                    }}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>Cooldown Duration</span>
                    <span className="font-mono text-emerald-400 font-bold">{Math.round(currentConfig.batchCooldown.cooldownMinSec / 60)} min</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="1800"
                    step="60"
                    value={currentConfig.batchCooldown.cooldownMinSec}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      const val = Number(e.target.value);
                      setCurrentConfig({
                        ...currentConfig,
                        batchCooldown: { ...currentConfig.batchCooldown, cooldownMinSec: val, cooldownMaxSec: val * 1.5 },
                      });
                    }}
                    className="w-full accent-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-4 border-t border-slate-800/80 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Window Start (Local)</label>
                  <input
                    type="time"
                    value={currentConfig.sendingWindow.startTime}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setCurrentConfig({
                        ...currentConfig,
                        sendingWindow: { ...currentConfig.sendingWindow, startTime: e.target.value },
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Window End (Local)</label>
                  <input
                    type="time"
                    value={currentConfig.sendingWindow.endTime}
                    onChange={(e) => {
                      setSelectedPreset('custom');
                      setCurrentConfig({
                        ...currentConfig,
                        sendingWindow: { ...currentConfig.sendingWindow, endTime: e.target.value },
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Circuit Breakers & Auto Halts */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">2.6 Circuit Breakers & Safety Halts</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Transient Failure Trip Threshold</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={currentConfig.circuitBreakers.consecutiveTransientFailures}
                      onChange={(e) => {
                        setSelectedPreset('custom');
                        setCurrentConfig({
                          ...currentConfig,
                          circuitBreakers: {
                            ...currentConfig.circuitBreakers,
                            consecutiveTransientFailures: Number(e.target.value),
                          },
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
                    />
                    <span className="text-slate-500">consecutive</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Daily Cap per Number</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="10"
                      max="2000"
                      value={currentConfig.volumeLimits.dailyCapPerNumber}
                      onChange={(e) => {
                        setSelectedPreset('custom');
                        setCurrentConfig({
                          ...currentConfig,
                          volumeLimits: {
                            ...currentConfig.volumeLimits,
                            dailyCapPerNumber: Number(e.target.value),
                          },
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
                    />
                    <span className="text-slate-500">msgs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Safety Score & Pacing Simulator */}
          <div className="space-y-4">
            {/* Live Safety Score Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Live Safety Score
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                    riskAnalysis.band === 'SAFE'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : riskAnalysis.band === 'MODERATE'
                      ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                      : riskAnalysis.band === 'HIGH'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {riskAnalysis.band} Risk
                </span>
              </div>

              <div className="py-2 text-center">
                <div className="text-4xl font-extrabold text-white font-mono">
                  {riskAnalysis.score}
                  <span className="text-sm font-normal text-slate-500"> / 100</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {riskAnalysis.score < 25
                    ? 'Safe for daily automated broadcasting'
                    : riskAnalysis.score < 50
                    ? 'Moderate risk with controlled pacing'
                    : 'High risk: Consider increasing delays'}
                </p>
              </div>

              {/* Contributing Factors */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                  Contributing Factors
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {riskAnalysis.factors.map((f: RiskFactor, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-950/60 border border-slate-800/60"
                    >
                      <span className="text-slate-300 truncate max-w-[180px]">{f.label}</span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          f.points > 0 ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {f.points > 0 ? `+${f.points}` : f.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Simulator Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    Dispatch Simulator
                  </h4>
                </div>
                <button
                  onClick={handleSimulate}
                  disabled={runningSim}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                >
                  {runningSim ? 'Simulating...' : 'Run Simulation'}
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Recipients Volume</span>
                    <span className="font-mono text-white font-bold">{simRecipients}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="2000"
                    step="50"
                    value={simRecipients}
                    onChange={(e) => setSimRecipients(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {simResult && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-300">
                      <span>Total Time:</span>
                      <span className="text-emerald-400 font-bold">{(simResult.totalDurationMin / 60).toFixed(1)} hrs</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Completion:</span>
                      <span className="text-white">{new Date(simResult.expectedFinishTime).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Long Breaks:</span>
                      <span className="text-white">{simResult.longBreaksCount} pauses</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. AI Advisor Tab */}
      {activeTab === 'advisor' && (
        <AiGuardrailAdvisorTab
          scope={scope}
          scopeId={scopeId}
          currentConfig={currentConfig}
          onApplyDraft={(draftConfig) => {
            setCurrentConfig(draftConfig);
            setActiveTab('config');
            setDiffDrawerOpen(true);
          }}
        />
      )}

      {/* 5. Activity Timeline Tab */}
      {activeTab === 'activity' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Guardrail Activity & Triggered Protections</h3>
            <button
              onClick={loadEvents}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 overflow-x-auto">
            {events.length === 0 ? (
              <p className="text-slate-500 text-xs py-8 text-center italic">No guardrail events recorded yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Severity</th>
                    <th className="py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {events.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-850">
                      <td className="py-2 px-3 text-slate-400">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="py-2 px-3 text-white font-bold">{e.type}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            e.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-300'
                              : e.severity === 'warning'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-teal-500/20 text-teal-300'
                          }`}
                        >
                          {e.severity}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300 font-sans max-w-xs truncate">{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 6. Versions Tab */}
      {activeTab === 'versions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Guardrail Version History & Safe Rollbacks</h3>
            <button
              onClick={loadVersions}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {versions.length === 0 ? (
              <p className="text-slate-500 text-xs py-8 text-center italic">No past versions archived.</p>
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-white">Version {v.version}</span>
                    <span className="text-[10px] text-slate-400 ml-3">
                      {new Date(v.savedAt).toLocaleString()} by {v.savedBy || 'admin'}
                    </span>
                    <p className="text-xs text-slate-300 mt-1">{v.diffSummary || 'Config snapshot'}</p>
                  </div>
                  <button
                    onClick={() => handleRestoreVersion(v.version)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-xs text-emerald-400 border border-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Rollback</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 7. Diff Review Drawer Modal */}
      {diffDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Review Guardrail Modifications ({diffs.length} changes)</span>
              </h3>
              <button onClick={() => setDiffDrawerOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-80 overflow-y-auto space-y-2 text-xs font-mono">
              {diffs.length === 0 ? (
                <div className="text-center py-6 text-slate-500">No modified parameters detected.</div>
              ) : (
                diffs.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                    <span className="text-slate-300 font-bold">{d.path}:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-rose-400 line-through">{String(d.oldVal)}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-emerald-400 font-bold">{String(d.newVal)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDiffDrawerOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer"
              >
                {saving ? 'Applying...' : 'Confirm & Apply Guardrails'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
