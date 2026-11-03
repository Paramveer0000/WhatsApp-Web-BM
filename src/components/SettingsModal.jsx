import React, { useState, useEffect } from 'react';
import { 
  X, 
  Server, 
  Key, 
  Globe, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck, 
  Filter, 
  Sparkles, 
  Zap, 
  FileCheck,
  UserCheck
} from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState('quality'); // 'general' | 'quality'
  const [settings, setSettings] = useState({
    evolution_api_url: 'http://localhost:8080',
    global_api_key: '',
    default_country_code: '91',
    default_min_delay: '12',
    default_max_delay: '25',
    default_simulate_typing: '1',
    // Evaluation & Quality Layer
    enable_number_validation: '1',
    validation_action: 'skip',
    enable_spam_filter: '1',
    spam_blacklist: 'lottery, urgent wire, claim prize, 100% free cash, bank password, crypto deposit, transfer money now',
    missing_variable_fallback: 'Valued Customer',
    max_consecutive_failures: '3',
    max_failure_rate_percent: '20'
  });

  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  // Quality Live Test state
  const [testEvalText, setTestEvalText] = useState('Hi {name}, you won a lottery prize! Click here for 100% free cash.');
  const [testEvalResult, setTestEvalResult] = useState(null);
  const [testingQuality, setTestingQuality] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(prev => ({ ...prev, ...data.settings }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus({ type: 'testing', message: 'Testing connection to Evolution API...' });
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const res = await fetch('/api/evolution/instances');
      const data = await res.json();

      if (data.success) {
        const count = Array.isArray(data.instances) ? data.instances.length : 0;
        setTestStatus({
          type: 'success',
          message: `Connected successfully! Found ${count} existing instance(s).`
        });
      } else {
        setTestStatus({
          type: 'error',
          message: data.error || 'Connection failed. Check URL and Global API Key.'
        });
      }
    } catch (err) {
      setTestStatus({
        type: 'error',
        message: `Failed to connect: ${err.message}`
      });
    }
  };

  const handleRunQualityTest = async () => {
    try {
      setTestingQuality(true);
      const res = await fetch('/api/evaluate/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: testEvalText,
          recipient: { name: '' } // test missing variable
        })
      });
      const data = await res.json();
      if (data.success) {
        setTestEvalResult(data.contentEvaluation);
      }
    } catch (err) {
      console.error('Quality test error:', err);
    } finally {
      setTestingQuality(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        if (onSaved) onSaved(data.settings);
        onClose();
      }
    } catch (err) {
      setTestStatus({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Application & Quality Settings</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('quality')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition cursor-pointer ${
              activeTab === 'quality'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Evaluation & Quality Layer</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
              Active
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition cursor-pointer ${
              activeTab === 'general'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Evolution Gateway & Delays</span>
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {activeTab === 'quality' ? (
            <div className="space-y-5">
              {/* Quality Layer Overview Banner */}
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300/90 leading-relaxed flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Task Quality & Health Protection</strong>
                  <p className="mt-0.5 text-slate-300 text-[11px]">
                    Every task is verified against delivery rules, spam trigger keywords, and WhatsApp number existence before sending to safeguard your WhatsApp account from algorithmic restrictions.
                  </p>
                </div>
              </div>

              {/* 1. WhatsApp Number Pre-Validation Gate */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Pre-Check WhatsApp Account Existence</div>
                      <div className="text-[11px] text-slate-400">Verifies recipient on WhatsApp via Evolution API prior to dispatch</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enable_number_validation === '1'}
                    onChange={(e) => setSettings({ ...settings, enable_number_validation: e.target.checked ? '1' : '0' })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                {settings.enable_number_validation === '1' && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Action when number is not registered on WhatsApp:
                    </label>
                    <select
                      value={settings.validation_action}
                      onChange={(e) => setSettings({ ...settings, validation_action: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      <option value="skip">Auto-Skip Recipient (Recommended - avoids failed dispatch strikes)</option>
                      <option value="warn">Log Quality Warning & Attempt Send Anyway</option>
                    </select>
                  </div>
                )}
              </div>

              {/* 2. Anti-Spam Blacklist & Fallback */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-bold text-white">Content Quality & Anti-Spam Keyword Filter</div>
                      <div className="text-[11px] text-slate-400">Scores text and flags high-risk words likely to trigger Meta spam bots</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enable_spam_filter === '1'}
                    onChange={(e) => setSettings({ ...settings, enable_spam_filter: e.target.checked ? '1' : '0' })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                {settings.enable_spam_filter === '1' && (
                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Spam Trigger Words (Comma Separated)
                      </label>
                      <textarea
                        rows={2}
                        value={settings.spam_blacklist}
                        onChange={(e) => setSettings({ ...settings, spam_blacklist: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="lottery, prize, free money, urgent transfer, credit card"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Missing Variable Fallback (used when contact name is empty)
                      </label>
                      <input
                        type="text"
                        value={settings.missing_variable_fallback}
                        onChange={(e) => setSettings({ ...settings, missing_variable_fallback: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                        placeholder="Valued Customer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Quality Circuit Breakers */}
              <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-red-400" />
                  <div className="text-xs font-bold text-white">Quality Circuit-Breaker Thresholds</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Max Consecutive Failures
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={settings.max_consecutive_failures}
                      onChange={(e) => setSettings({ ...settings, max_consecutive_failures: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Pauses queue if consecutive dispatches fail (Default: 3)</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Max Failure Rate Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="50"
                      value={settings.max_failure_rate_percent}
                      onChange={(e) => setSettings({ ...settings, max_failure_rate_percent: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Auto-halts if error rate exceeds threshold after 10+ messages</p>
                  </div>
                </div>
              </div>

              {/* Interactive Live Quality Evaluation Tester */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Live Quality Layer Evaluation Test</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunQualityTest}
                    disabled={testingQuality}
                    className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/30 transition cursor-pointer"
                  >
                    {testingQuality ? 'Evaluating...' : 'Test Evaluation'}
                  </button>
                </div>

                <input
                  type="text"
                  value={testEvalText}
                  onChange={(e) => setTestEvalText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none"
                  placeholder="Enter sample message to test quality scoring..."
                />

                {testEvalResult && (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">
                        Score: <strong className={testEvalResult.qualityScore >= 70 ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>{testEvalResult.qualityScore} / 100</strong>
                      </span>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                        testEvalResult.isQualityPassed ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                      }`}>
                        {testEvalResult.isQualityPassed ? 'Quality Passed' : 'Quality Warnings Flagged'}
                      </span>
                    </div>
                    {testEvalResult.issues.length > 0 && (
                      <div className="text-red-400 text-[11px] font-medium">
                        Issues: {testEvalResult.issues.join('; ')}
                      </div>
                    )}
                    <div className="text-slate-400 text-[11px]">
                      Audit Notes: {testEvalResult.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Evolution API URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Evolution API URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={settings.evolution_api_url}
                    onChange={(e) => setSettings({ ...settings, evolution_api_url: e.target.value })}
                    placeholder="http://localhost:8080 or https://api.yourdomain.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Global API Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Global API Key (AUTHENTICATION_API_KEY)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={settings.global_api_key}
                    onChange={(e) => setSettings({ ...settings, global_api_key: e.target.value })}
                    placeholder="Enter your Evolution API Global Key"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Default Country Code & Pacing */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Default Country Code
                  </label>
                  <input
                    type="text"
                    value={settings.default_country_code}
                    onChange={(e) => setSettings({ ...settings, default_country_code: e.target.value })}
                    placeholder="91"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Default Min Delay (s)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={settings.default_min_delay}
                    onChange={(e) => setSettings({ ...settings, default_min_delay: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Default Max Delay (s)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    value={settings.default_max_delay}
                    onChange={(e) => setSettings({ ...settings, default_max_delay: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Connection Test Status Banner */}
              {testStatus && (
                <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                  testStatus.type === 'success' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200' :
                  testStatus.type === 'error' ? 'bg-red-950/60 border border-red-500/40 text-red-200' :
                  'bg-blue-950/60 border border-blue-500/40 text-blue-200'
                }`}>
                  {testStatus.type === 'testing' && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                  {testStatus.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {testStatus.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
                  <span>{testStatus.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            {activeTab === 'general' ? (
              <button
                type="button"
                onClick={handleTestConnection}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                Test API Connection
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Quality & App Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
