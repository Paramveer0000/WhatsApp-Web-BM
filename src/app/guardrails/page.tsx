'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
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
  FileText,
  LayoutDashboard,
  Users,
  MessageSquare,
  Smartphone,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Menu
} from 'lucide-react';
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

export default function GuardrailsPage() {
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
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
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => d?.user && setCurrentUser(d.user))
      .catch(() => {});

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

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const loadGuardrails = async (newScope: 'global' | 'instance' | 'campaign', newScopeId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/guardrails?scope=${newScope}&scopeId=${encodeURIComponent(newScopeId)}`);
      const data = await res.json();
      if (res.ok && data.effective) {
        setCurrentConfig(data.effective);
        setOriginalConfig(data.effective);
        setSources(data.sources || {});
        setStrictMode(Boolean(data.strictMode));
        setVersion(data.version || 1);
        if (data.userRole) setUserRole(data.userRole);

        if (data.profile?.presetKey) {
          setSelectedPreset(data.profile.presetKey);
        } else {
          setSelectedPreset('custom');
        }
      }
    } catch (err) {
      console.error('Failed to load guardrails:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/v1/guardrails/events?limit=50');
      const data = await res.json();
      if (res.ok && data.events) setEvents(data.events);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const loadVersions = async () => {
    try {
      const res = await fetch(`/api/v1/guardrails/versions?scope=${scope}&scopeId=${encodeURIComponent(scopeId)}`);
      const data = await res.json();
      if (res.ok && data.versions) setVersions(data.versions);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'activity') loadEvents();
    if (activeTab === 'versions') loadVersions();
  }, [activeTab]);

  // Handle Preset Selection
  const handleSelectPreset = (key: string) => {
    if (GUARDRAIL_PRESETS[key]) {
      const presetConfig = JSON.parse(JSON.stringify(GUARDRAIL_PRESETS[key].config));
      setCurrentConfig(presetConfig);
      setSelectedPreset(key);
    }
  };

  // Field updater
  const updateField = (path: string, value: any) => {
    setSelectedPreset('custom');
    setCurrentConfig((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const parts = path.split('.');
      let curr = copy;
      for (let i = 0; i < parts.length - 1; i++) {
        curr = curr[parts[i]];
      }
      curr[parts[parts.length - 1]] = value;
      return copy;
    });
  };

  // Toggle card collapse
  const toggleSection = (sec: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/guardrails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          scopeId,
          presetKey: selectedPreset,
          config: currentConfig,
          strictMode,
          version,
          diffSummary: `Updated from preset "${selectedPreset}" (v${version})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save guardrails');

      setOriginalConfig(currentConfig);
      setVersion(data.version);
      setDiffDrawerOpen(false);
      setSaveSuccessMsg('Guardrails saved successfully and pushed to workers!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Run Simulator
  const handleRunSimulator = async () => {
    setRunningSim(true);
    try {
      const res = await fetch('/api/v1/guardrails/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: currentConfig,
          recipientsCount: simRecipients,
          startTime: simStartTime,
        }),
      });
      const data = await res.json();
      if (res.ok && data.simulation) {
        setSimResult(data.simulation);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRunningSim(false);
    }
  };

  // Restore previous version
  const handleRestoreVersion = async (versionId: string) => {
    if (!confirm('Restore this guardrail configuration snapshot?')) return;
    try {
      const res = await fetch(`/api/v1/guardrails/versions/${versionId}/restore`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore version');
      alert(`Restored to version snapshot ${data.restoredFromVersion}!`);
      loadGuardrails(scope, scopeId);
      setActiveTab('config');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Diff list computation
  const diffs = useMemo(() => {
    const list: { path: string; oldVal: string; newVal: string }[] = [];
    const traverse = (o: any, c: any, prefix = '') => {
      for (const k of Object.keys(c)) {
        const full = prefix ? `${prefix}.${k}` : k;
        if (typeof c[k] === 'object' && c[k] !== null && !Array.isArray(c[k])) {
          traverse(o?.[k], c[k], full);
        } else if (JSON.stringify(o?.[k]) !== JSON.stringify(c[k])) {
          list.push({
            path: full,
            oldVal: JSON.stringify(o?.[k]),
            newVal: JSON.stringify(c[k]),
          });
        }
      }
    };
    traverse(originalConfig, currentConfig);
    return list;
  }, [originalConfig, currentConfig]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b141a] text-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-emerald-400 font-mono text-sm">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading Anti-Ban Guardrails Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b141a] text-slate-100 flex flex-col md:flex-row font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* ========================================================= */}
      {/* LEFT SIDEBAR (DESKTOP)                                    */}
      {/* ========================================================= */}
      <aside 
        className={`bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-300 z-30 sticky top-0 h-screen ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        } hidden md:flex`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50 shrink-0">
              <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white">BulkFlow</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    v2.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">WhatsApp Gateway</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Dashboard */}
          <Link
            href="/?tab=overview"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850 transition"
            title="Dashboard Overview"
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Link>

          {/* Campaigns */}
          <Link
            href="/?tab=campaigns"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850 transition"
            title="Campaigns"
          >
            <Send className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Campaigns</span>}
          </Link>

          {/* Contacts */}
          <Link
            href="/?tab=contacts"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850 transition"
            title="Contacts & Lists"
          >
            <Users className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Contacts</span>}
          </Link>

          {/* Templates */}
          <Link
            href="/?tab=templates"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850 transition"
            title="Message Templates"
          >
            <FileText className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Templates</span>}
          </Link>

          {/* Replies */}
          <Link
            href="/?tab=replies"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850 transition"
            title="Replies & Chat"
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Replies</span>}
          </Link>

          {/* Instances */}
          <Link
            href="/?tab=instances"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850 transition"
            title="WhatsApp Instances"
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Instances</span>}
          </Link>

          {/* Guardrails (ACTIVE ON THIS PAGE) */}
          <Link
            href="/guardrails"
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-md shadow-emerald-950/40 transition cursor-pointer"
            title="Anti-Ban Guardrails Settings"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Guardrails</span>}
            </div>
            {!sidebarCollapsed && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold">
                Active
              </span>
            )}
          </Link>

          {/* Reports */}
          <Link
            href="/?tab=reports"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850 transition"
            title="Reports & Analytics"
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Reports</span>}
          </Link>

          {/* System */}
          <Link
            href="/?tab=system"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850 transition"
            title="System Health & Metrics"
          >
            <Activity className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>System</span>}
          </Link>

          {/* Settings */}
          <Link
            href="/?tab=settings"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-850 transition"
            title="Gateway Settings"
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </Link>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          {!sidebarCollapsed && currentUser && (
            <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <div className="truncate">
                <p className="text-[11px] font-bold text-slate-200 truncate">{currentUser.email}</p>
                <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">{currentUser.role || 'Admin'}</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition cursor-pointer ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
            title="Log out"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
      
      {/* ========================================================= */}
      {/* 1. TOP HEADER & SCOPE SELECTOR                            */}
      {/* ========================================================= */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/?tab=overview"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white border border-slate-700/60 transition shadow-sm"
              title="Return to Main Console"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Back to Console</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">Anti-Ban Guardrails</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  v{version}
                </span>
                {userRole === 'OPERATOR' && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                    Read-Only (Operator)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Precision dispatch safety, pacing curves & anti-detection controls</p>
            </div>
          </div>

          {/* Scope Selector & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Selection */}
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

            {/* Scope Specific ID Dropdown */}
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

            {/* Tab switcher */}
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
                <span>Save Changes</span>
                {hasUnsavedChanges && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Save Success Alert Banner */}
      {saveSuccessMsg && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-2 text-center text-xs text-emerald-300 font-mono">
          ✓ {saveSuccessMsg}
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ========================================================= */}
        {/* 2. PRESETS BAR                                            */}
        {/* ========================================================= */}
        {activeTab === 'config' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Security Preset Configurations</span>
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/v1/guardrails/export?scope=${scope}&scopeId=${encodeURIComponent(scopeId)}`}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 text-[11px] font-mono flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Export JSON</span>
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(GUARDRAIL_PRESETS).map(([key, preset]) => {
                const isSelected = selectedPreset === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectPreset(key)}
                    className={`text-left p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">{preset.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Custom Indicator */}
              <div
                className={`p-3 rounded-xl border flex flex-col justify-between ${
                  selectedPreset === 'custom'
                    ? 'bg-sky-950/40 border-sky-500/80'
                    : 'bg-slate-950/50 border-slate-800/60 opacity-60'
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-sky-400">Custom</span>
                  <p className="text-[11px] text-slate-400 mt-1">Manual overrides customized for your account.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. CONFIGURATION SECTIONS + LIVE SAFETY PANEL             */}
        {/* ========================================================= */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column (2/3 width) - Section Cards */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Search and Filter Bar */}
              <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3">
                <div className="flex items-center gap-2 flex-1 max-w-sm bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search guardrail parameters..."
                    className="bg-transparent w-full focus:outline-none text-xs"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={strictMode}
                      onChange={(e) => setStrictMode(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-slate-300">Strict Mode</span>
                  </label>
                </div>
              </div>

              {/* Section 2.1: Message Pacing */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('pacing')}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">2.1 Message Pacing & Human Delay Curves</h3>
                      <p className="text-xs text-slate-400">Jitter interval distribution, natural pauses, and presence simulation</p>
                    </div>
                  </div>
                  {collapsedSections['pacing'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>

                {!collapsedSections['pacing'] && (
                  <div className="space-y-4 pt-2 border-t border-slate-800">
                    {/* Min & Max Delay Range Slider + Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                          <span>Min Delay (s)</span>
                          <span className="font-mono text-emerald-400">{currentConfig.pacing.minDelay}s</span>
                        </div>
                        <input
                          type="range"
                          min={3}
                          max={60}
                          value={currentConfig.pacing.minDelay}
                          onChange={(e) => updateField('pacing.minDelay', Number(e.target.value))}
                          className="w-full accent-emerald-500"
                        />
                        {currentConfig.pacing.minDelay < 8 && (
                          <p className="text-[11px] text-rose-400 font-mono mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Min delay &lt; 8s triggers WhatsApp anti-spam flags.
                          </p>
                        )}
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-300 mb-1">
                          <span>Max Delay (s)</span>
                          <span className="font-mono text-emerald-400">{currentConfig.pacing.maxDelay}s</span>
                        </div>
                        <input
                          type="range"
                          min={currentConfig.pacing.minDelay}
                          max={120}
                          value={currentConfig.pacing.maxDelay}
                          onChange={(e) => updateField('pacing.maxDelay', Number(e.target.value))}
                          className="w-full accent-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Delay Distribution Selector */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Interval Distribution Algorithm
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['uniform', 'triangular', 'log-normal'].map((dist) => (
                          <button
                            key={dist}
                            type="button"
                            onClick={() => updateField('pacing.distribution', dist)}
                            className={`p-2.5 rounded-xl border text-xs capitalize text-left transition ${
                              currentConfig.pacing.distribution === dist
                                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 font-bold'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {dist === 'log-normal' ? 'Log-Normal (Human)' : dist}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Human Pause & Typing Simulation */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                          <input
                            type="checkbox"
                            checked={currentConfig.pacing.humanPause.enabled}
                            onChange={(e) => updateField('pacing.humanPause.enabled', e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          <span>Random Human Pause</span>
                        </label>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {currentConfig.pacing.humanPause.probabilityPercent}% chance of a 30-90s pause
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                          <input
                            type="checkbox"
                            checked={currentConfig.pacing.typingSimulation.enabled}
                            onChange={(e) => updateField('pacing.typingSimulation.enabled', e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          <span>Typing Simulation</span>
                        </label>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Sends "composing..." status {currentConfig.pacing.typingSimulation.baseMsPerChar}ms per character
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2.2: Volume Limits */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('volume')}
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">2.2 Volume Limits & Daily Caps</h3>
                      <p className="text-xs text-slate-400">Daily quotas per number, hourly ceilings, and contact frequency</p>
                    </div>
                  </div>
                  {collapsedSections['volume'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>

                {!collapsedSections['volume'] && (
                  <div className="space-y-4 pt-2 border-t border-slate-800">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Daily Cap / Number</label>
                        <input
                          type="number"
                          value={currentConfig.volumeLimits.dailyCapPerNumber}
                          onChange={(e) => updateField('volumeLimits.dailyCapPerNumber', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Hourly Cap</label>
                        <input
                          type="number"
                          value={currentConfig.volumeLimits.hourlyCap}
                          onChange={(e) => updateField('volumeLimits.hourlyCap', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Per Minute Cap</label>
                        <input
                          type="number"
                          value={currentConfig.volumeLimits.perMinuteCap}
                          onChange={(e) => updateField('volumeLimits.perMinuteCap', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Contact Freq (Days)</label>
                        <input
                          type="number"
                          value={currentConfig.volumeLimits.perContactFrequencyDays}
                          onChange={(e) => updateField('volumeLimits.perContactFrequencyDays', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          When Daily Cap is Reached
                        </label>
                        <select
                          value={currentConfig.volumeLimits.onCapReached}
                          onChange={(e) => updateField('volumeLimits.onCapReached', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                        >
                          <option value="pause">Pause and resume next window</option>
                          <option value="rotate">Rotate to another number</option>
                          <option value="stop">Stop campaign immediately</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Timezone for Midnight Reset
                        </label>
                        <input
                          type="text"
                          value={currentConfig.volumeLimits.timezone}
                          onChange={(e) => updateField('volumeLimits.timezone', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2.3: Batch & Cooldown */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('batch')}
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">2.3 Batch Cycles & Cool Down Periods</h3>
                      <p className="text-xs text-slate-400">Randomized batch sizes and long rest intervals</p>
                    </div>
                  </div>
                  {collapsedSections['batch'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>

                {!collapsedSections['batch'] && (
                  <div className="space-y-4 pt-2 border-t border-slate-800">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Batch Min Size</label>
                        <input
                          type="number"
                          value={currentConfig.batchCooldown.batchSizeMin}
                          onChange={(e) => updateField('batchCooldown.batchSizeMin', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Batch Max Size</label>
                        <input
                          type="number"
                          value={currentConfig.batchCooldown.batchSizeMax}
                          onChange={(e) => updateField('batchCooldown.batchSizeMax', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Cooldown Min (s)</label>
                        <input
                          type="number"
                          value={currentConfig.batchCooldown.cooldownMinSec}
                          onChange={(e) => updateField('batchCooldown.cooldownMinSec', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Cooldown Max (s)</label>
                        <input
                          type="number"
                          value={currentConfig.batchCooldown.cooldownMaxSec}
                          onChange={(e) => updateField('batchCooldown.cooldownMaxSec', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Long break every {currentConfig.batchCooldown.longBreakEvery} messages:</span>
                        <span className="font-mono text-emerald-400">
                          {(currentConfig.batchCooldown.longBreakMinSec / 60).toFixed(0)}-
                          {(currentConfig.batchCooldown.longBreakMaxSec / 60).toFixed(0)} minutes
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2.4: Sending Window */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('window')}
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">2.4 Sending Window & Blackout Schedule</h3>
                      <p className="text-xs text-slate-400">Prevent late-night sends, weekend halts, and holiday blackouts</p>
                    </div>
                  </div>
                  {collapsedSections['window'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>

                {!collapsedSections['window'] && (
                  <div className="space-y-4 pt-2 border-t border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Daily Sending Hours</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={currentConfig.sendingWindow.startTime}
                            onChange={(e) => updateField('sendingWindow.startTime', e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                          />
                          <span className="text-slate-500">to</span>
                          <input
                            type="time"
                            value={currentConfig.sendingWindow.endTime}
                            onChange={(e) => updateField('sendingWindow.endTime', e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Allowed Days of Week</label>
                        <div className="flex flex-wrap gap-1">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => {
                            const isIncluded = currentConfig.sendingWindow.daysOfWeek.includes(idx);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  const list = currentConfig.sendingWindow.daysOfWeek;
                                  const updated = isIncluded ? list.filter((d) => d !== idx) : [...list, idx];
                                  updateField('sendingWindow.daysOfWeek', updated);
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition ${
                                  isIncluded
                                    ? 'bg-emerald-600 text-white font-bold'
                                    : 'bg-slate-950 border border-slate-800 text-slate-500'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2.7: Content Safety */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('content')}
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">2.7 Content Safety & Spam Prevention</h3>
                      <p className="text-xs text-slate-400">Enforce spintax, link filters, blocked spam keywords, and opt-out footers</p>
                    </div>
                  </div>
                  {collapsedSections['content'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>

                {!collapsedSections['content'] && (
                  <div className="space-y-4 pt-2 border-t border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                          <input
                            type="checkbox"
                            checked={currentConfig.contentSafety.requireSpintax}
                            onChange={(e) => updateField('contentSafety.requireSpintax', e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          <span>Require Spintax Variations</span>
                        </label>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Min {currentConfig.contentSafety.minUniqueVariants} unique variants required before launching
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                          <input
                            type="checkbox"
                            checked={currentConfig.contentSafety.mandatoryOptOut}
                            onChange={(e) => updateField('contentSafety.mandatoryOptOut', e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          <span>Mandatory Opt-Out Notice</span>
                        </label>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Appends "{currentConfig.contentSafety.optOutText}" to all campaign messages
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Link Policy
                      </label>
                      <select
                        value={currentConfig.contentSafety.linkPolicy}
                        onChange={(e) => updateField('contentSafety.linkPolicy', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                      >
                        <option value="max_one">Allow maximum 1 verified link</option>
                        <option value="block">Block all external links (Ultra-Safe)</option>
                        <option value="allow">Allow unrestricted links</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Right Column (1/3 width, STICKY LIVE SAFETY PANEL) */}
            <div className="lg:col-span-4 sticky top-24 space-y-6">
              
              {/* Risk Gauge Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Safety Score</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      riskAnalysis.band === 'SAFE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : riskAnalysis.band === 'MODERATE'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {riskAnalysis.band} RISK
                  </span>
                </div>

                {/* Animated Radial / Meter */}
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="relative flex items-center justify-center w-36 h-36 rounded-full border-4 border-slate-800">
                    <div className="text-center">
                      <span className="text-4xl font-extrabold text-white font-mono tabular-nums">
                        {riskAnalysis.score}
                      </span>
                      <span className="text-[11px] text-slate-400 block font-mono">/ 100</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-3 text-center">
                    {riskAnalysis.score < 30
                      ? 'Safe for daily automated broadcasting'
                      : riskAnalysis.score < 60
                      ? 'Moderate risk: Recommended for established numbers only'
                      : 'High risk: May trigger WhatsApp soft-bans or temporary limits'}
                  </p>
                </div>

                {/* Contributing Factors */}
                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Contributing Factors
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {riskAnalysis.factors.map((factor) => (
                      <div
                        key={factor.id}
                        className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">{factor.label}</span>
                          <span
                            className={`font-mono font-bold ${
                              factor.points > 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {factor.points > 0 ? `+${factor.points}` : factor.points} pts
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">{factor.tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Effective Limits Today */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Effective Limits Today</h4>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Daily Cap:</span>
                    <span className="text-white">{currentConfig.volumeLimits.dailyCapPerNumber} msgs/number</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Avg Pace:</span>
                    <span className="text-white">
                      {((currentConfig.pacing.minDelay + currentConfig.pacing.maxDelay) / 2).toFixed(1)}s / msg
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Est. 1,000 Duration:</span>
                    <span className="text-emerald-400">
                      {(
                        (1000 * ((currentConfig.pacing.minDelay + currentConfig.pacing.maxDelay) / 2)) /
                        3600
                      ).toFixed(1)}{' '}
                      hours
                    </span>
                  </div>
                </div>
              </div>

              {/* Simulator Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pacing Simulator</span>
                  </h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Simulated Audience Size</label>
                    <input
                      type="number"
                      value={simRecipients}
                      onChange={(e) => setSimRecipients(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRunSimulator}
                    disabled={runningSim}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <Play className="w-3 h-3 text-emerald-400" />
                    <span>{runningSim ? 'Running projection...' : 'Simulate Run'}</span>
                  </button>

                  {simResult && (
                    <div className="space-y-3 pt-3 border-t border-slate-800 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Est. Duration:</span>
                        <span className="text-emerald-400">{(simResult.totalDurationMin / 60).toFixed(1)} hrs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Expected Finish:</span>
                        <span className="text-white text-[11px]">{simResult.expectedFinishTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Long Breaks:</span>
                        <span className="text-white">{simResult.longBreaksCount} pauses</span>
                      </div>

                      {/* Mini Timeline Chart */}
                      {simResult.timeline.length > 0 && (
                        <div className="h-28 w-full pt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={simResult.timeline}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                              <XAxis dataKey="hour" stroke="#64748b" fontSize={9} />
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* AI ADVISOR TAB                                            */}
        {/* ========================================================= */}
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

        {/* ========================================================= */}
        {/* 4. ACTIVITY TIMELINE TAB                                  */}
        {/* ========================================================= */}
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

            <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto">
              {events.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No guardrail protection triggers recorded yet.
                </div>
              ) : (
                events.map((evt) => (
                  <div key={evt.id} className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${
                            evt.severity === 'critical'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                              : evt.severity === 'warning'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                          }`}
                        >
                          {evt.type}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(evt.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 mt-1 font-mono">{JSON.stringify(evt.detail)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. VERSION HISTORY TAB                                    */}
        {/* ========================================================= */}
        {activeTab === 'versions' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Snapshot Version History (Last 20)</h3>
            </div>

            <div className="divide-y divide-slate-800/60 max-h-[600px] overflow-y-auto">
              {versions.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No previous snapshots saved yet.
                </div>
              ) : (
                versions.map((ver) => (
                  <div key={ver.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">Version {ver.version}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Saved by {ver.savedBy || 'Admin'} on {new Date(ver.savedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{ver.diffSummary || 'Config update'}</p>
                    </div>

                    <button
                      onClick={() => handleRestoreVersion(ver.id)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-semibold transition"
                    >
                      Restore Snapshot
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* ========================================================= */}
      {/* 6. DIFF REVIEW DRAWER                                     */}
      {/* ========================================================= */}
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
                      <span className="text-rose-400 line-through">{d.oldVal}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-emerald-400 font-bold">{d.newVal}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDiffDrawerOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow"
              >
                {saving ? 'Applying...' : 'Confirm & Apply Guardrails'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center justify-around z-40">
        <Link href="/?tab=overview" className="flex flex-col items-center gap-1 text-[10px] text-slate-400">
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <Link href="/?tab=campaigns" className="flex flex-col items-center gap-1 text-[10px] text-slate-400">
          <Send className="w-4 h-4" />
          <span>Campaigns</span>
        </Link>
        <Link href="/guardrails" className="flex flex-col items-center gap-1 text-[10px] text-emerald-400">
          <Shield className="w-4 h-4" />
          <span>Guardrails</span>
        </Link>
        <Link href="/?tab=instances" className="flex flex-col items-center gap-1 text-[10px] text-slate-400">
          <Smartphone className="w-4 h-4" />
          <span>Instances</span>
        </Link>
        <Link href="/?tab=settings" className="flex flex-col items-center gap-1 text-[10px] text-slate-400">
          <SettingsIcon className="w-4 h-4" />
          <span>Settings</span>
        </Link>
      </div>

    </div>
  );
}

