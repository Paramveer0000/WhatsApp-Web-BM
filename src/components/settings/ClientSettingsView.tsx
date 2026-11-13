'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sparkles,
  User,
  Lock,
  Webhook,
  Shield,
  Save,
  CheckCircle2,
  Key,
  Building,
  Phone,
  Mail,
  Zap,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import InfoButton from '@/components/InfoButton';

export function ClientSettingsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [planName, setPlanName] = useState('Starter');
  const [maxInstances, setMaxInstances] = useState(1);
  const [monthlyMsgCap, setMonthlyMsgCap] = useState(10000);

  // AI Integration State
  const [aiApiKey, setAiApiKey] = useState('');
  const [hasAiKey, setHasAiKey] = useState(false);
  const [aiModel, setAiModel] = useState('anthropic/claude-3.5-haiku');

  // Webhooks
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  // Password Update
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/client/settings');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch settings');

      if (data.settings) {
        const s = data.settings;
        setCompanyName(s.companyName || '');
        setOwnerName(s.ownerName || '');
        setOwnerEmail(s.ownerEmail || '');
        setOwnerPhone(s.ownerPhone || '');
        setPlanName(s.planName || 'Starter');
        setMaxInstances(s.maxInstances || 1);
        setMonthlyMsgCap(s.monthlyMsgCap || 10000);
        setHasAiKey(s.hasAiKey);
        setAiApiKey(s.aiApiKeyMasked || '');
        setAiModel(s.aiModel || 'anthropic/claude-3.5-haiku');
        setWebhookUrl(s.webhookUrl || '');
        setWebhookSecret(s.webhookSecret || '');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match.');
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        companyName,
        ownerName,
        ownerPhone,
        aiApiKey,
        aiModel,
        webhookUrl,
        webhookSecret,
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch('/api/client/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');

      toast.success('Workspace settings updated successfully! 🚀');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-950/50 shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-black text-white">{companyName || 'Workspace'} Settings</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 font-bold uppercase">
                {planName} Plan
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Configure your dedicated AI API keys, company profile, login security, and external webhooks.
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0c57e4] hover:bg-[#0944b5] text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-900/30 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Section 1: AI Engine & API Key */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Your AI Engine & API Key</h3>
              </div>
              <InfoButton
                title="Tenant-Isolated AI Key"
                description="Enter your own OpenRouter, OpenAI, or Gemini API key. All AI message variations, smart replies, and auto-responders will use your private key."
                recommended="OpenRouter (sk-or-v1-...) gives access to Claude 3.5, GPT-4o, and Llama 3 with low latency"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Private AI API Key (OpenRouter / OpenAI / Anthropic)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={hasAiKey ? '•••••••••••••••• (API Key Active)' : 'sk-or-v1-... or sk-...'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition"
                  />
                  {hasAiKey && (
                    <span className="absolute right-3 top-2.5 text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Connected
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Leave blank to disable AI features, or paste your new key to update.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">AI Model Selection</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="anthropic/claude-3.5-haiku">Anthropic Claude 3.5 Haiku (Fast & Natural)</option>
                  <option value="openai/gpt-4o-mini">OpenAI GPT-4o Mini (Cost Effective)</option>
                  <option value="google/gemini-flash-1.5">Google Gemini 1.5 Flash (Ultra Fast)</option>
                  <option value="meta-llama/llama-3.1-8b-instruct">Meta Llama 3.1 8B (Open Source)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Company Profile */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Building className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Company & Profile Details</h3>
              </div>
              <InfoButton
                title="Business Profile"
                description="Your organization name and contact details used in notification headers and campaign metadata."
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Company Legal Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Owner / Contact Name</label>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Login Email (Read-Only)</label>
                <input
                  type="text"
                  disabled
                  value={ownerEmail}
                  className="w-full bg-slate-950/50 border border-slate-800/60 rounded-xl p-2.5 text-xs text-slate-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Password Security */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Change Account Password</h3>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Webhook & CRM Integration */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Webhook className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-white">External Webhooks & Forwarding</h3>
              </div>
              <InfoButton
                title="Inbound Webhook"
                description="Automatically forwards incoming customer messages and delivery statuses to your external CRM, Zapier, or Make.com webhook."
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Inbound Webhook URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-crm.com/api/whatsapp-webhook"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Webhook Secret (Optional)</label>
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="Optional secret token for x-webhook-signature verification"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Plan Quotas Overview */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-xs font-bold text-white">Allocated Plan Quotas</p>
              <p className="text-[11px] text-slate-400">
                You are currently provisioned with <strong>{maxInstances} WhatsApp {maxInstances === 1 ? 'Number' : 'Numbers'}</strong> and a cap of <strong>{monthlyMsgCap.toLocaleString()} messages/month</strong>.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Contact your SaaS administrator to upgrade quotas.</p>
        </div>
      </form>
    </div>
  );
}
