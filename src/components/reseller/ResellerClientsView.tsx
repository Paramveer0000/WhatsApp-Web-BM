'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
  Plus,
  Search,
  Filter,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  CreditCard,
  Wallet,
  Calendar,
  MoreVertical,
  CheckCircle2,
  Clock,
  Ban,
  Trash2,
  Edit2,
  LogIn,
  Layers,
  Sparkles,
  Zap,
  Globe,
  DollarSign,
  TrendingUp,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface ResellerClientItem {
  id: string;
  companyName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  planName: string;
  status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'EXPIRED';
  billingCycle: string;
  price: number;
  currency: string;
  renewalDate: string | null;
  maxInstances: number;
  maxContacts: number;
  monthlyMsgCap: number;
  walletBalance: number;
  hasCrmPipeline: boolean;
  hasChatbot: boolean;
  hasMultiWarmup: boolean;
  hasDamMedia: boolean;
  hasAiResponder: boolean;
  customDomain: string | null;
  brandColor: string;
  createdAt: string;
}

interface ResellerMetrics {
  totalClients: number;
  activeClients: number;
  trialClients: number;
  suspendedClients: number;
  mrrTotal: number;
  totalInstancesAllocated: number;
  totalWalletBalance: number;
}

const DEFAULT_PLANS = [
  { name: 'Starter', price: 1499, instances: 1, contacts: 5000, msgs: 15000 },
  { name: 'Growth', price: 3999, instances: 3, contacts: 25000, msgs: 50000 },
  { name: 'Enterprise', price: 9999, instances: 10, contacts: 100000, msgs: 250000 },
  { name: 'Custom VIP', price: 7500, instances: 6, contacts: 50000, msgs: 100000 },
];

export function ResellerClientsView() {
  const [clients, setClients] = useState<ResellerClientItem[]>([]);
  const [metrics, setMetrics] = useState<ResellerMetrics>({
    totalClients: 0,
    activeClients: 0,
    trialClients: 0,
    suspendedClients: 0,
    mrrTotal: 0,
    totalInstancesAllocated: 0,
    totalWalletBalance: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ResellerClientItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  // Form Fields
  const [formCompany, setFormCompany] = useState('');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('Client@123');
  const [formPlan, setFormPlan] = useState('Growth');
  const [formBillingCycle, setFormBillingCycle] = useState('MONTHLY');
  const [formPrice, setFormPrice] = useState(3999);
  const [formMaxInstances, setFormMaxInstances] = useState(3);
  const [formMaxContacts, setFormMaxContacts] = useState(25000);
  const [formMonthlyCap, setFormMonthlyCap] = useState(50000);
  const [formWallet, setFormWallet] = useState(1000);
  const [formHasCrm, setFormHasCrm] = useState(true);
  const [formHasChatbot, setFormHasChatbot] = useState(true);
  const [formHasWarmup, setFormHasWarmup] = useState(true);
  const [formHasDam, setFormHasDam] = useState(true);
  const [formHasAi, setFormHasAi] = useState(true);
  const [formDomain, setFormDomain] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'TRIAL' | 'SUSPENDED'>('ACTIVE');

  const fetchClients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/reseller/clients?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load clients');
      const data = await res.json();

      if (data.success) {
        setClients(data.clients || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err: any) {
      toast.error('Failed to load reseller clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [statusFilter, searchQuery]);

  const openCreateModal = () => {
    setEditingClient(null);
    setFormCompany('');
    setFormOwnerName('');
    setFormEmail('');
    setFormPhone('');
    setFormPassword('Client@123');
    setFormPlan('Growth');
    setFormBillingCycle('MONTHLY');
    setFormPrice(3999);
    setFormMaxInstances(3);
    setFormMaxContacts(25000);
    setFormMonthlyCap(50000);
    setFormWallet(1000);
    setFormHasCrm(true);
    setFormHasChatbot(true);
    setFormHasWarmup(true);
    setFormHasDam(true);
    setFormHasAi(true);
    setFormDomain('');
    setFormStatus('ACTIVE');
    setShowCreateModal(true);
  };

  const openEditModal = (client: ResellerClientItem) => {
    setEditingClient(client);
    setFormCompany(client.companyName);
    setFormOwnerName(client.ownerName);
    setFormEmail(client.ownerEmail);
    setFormPhone(client.ownerPhone || '');
    setFormPassword('');
    setFormPlan(client.planName);
    setFormBillingCycle(client.billingCycle);
    setFormPrice(client.price);
    setFormMaxInstances(client.maxInstances);
    setFormMaxContacts(client.maxContacts);
    setFormMonthlyCap(client.monthlyMsgCap);
    setFormWallet(client.walletBalance);
    setFormHasCrm(client.hasCrmPipeline);
    setFormHasChatbot(client.hasChatbot);
    setFormHasWarmup(client.hasMultiWarmup);
    setFormHasDam(client.hasDamMedia);
    setFormHasAi(client.hasAiResponder);
    setFormDomain(client.customDomain || '');
    setFormStatus(client.status as any);
    setShowCreateModal(true);
  };

  const handlePlanChange = (planName: string) => {
    setFormPlan(planName);
    const matched = DEFAULT_PLANS.find((p) => p.name === planName);
    if (matched) {
      setFormPrice(matched.price);
      setFormMaxInstances(matched.instances);
      setFormMaxContacts(matched.contacts);
      setFormMonthlyCap(matched.msgs);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCompany.trim() || !formOwnerName.trim() || (!editingClient && !formEmail.trim())) {
      toast.error('Company Name, Owner Name, and Email are required.');
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        companyName: formCompany.trim(),
        ownerName: formOwnerName.trim(),
        ownerPhone: formPhone.trim(),
        planName: formPlan,
        billingCycle: formBillingCycle,
        price: formPrice,
        maxInstances: formMaxInstances,
        maxContacts: formMaxContacts,
        monthlyMsgCap: formMonthlyCap,
        walletBalance: formWallet,
        hasCrmPipeline: formHasCrm,
        hasChatbot: formHasChatbot,
        hasMultiWarmup: formHasWarmup,
        hasDamMedia: formHasDam,
        hasAiResponder: formHasAi,
        customDomain: formDomain.trim() || null,
        status: formStatus,
      };

      if (!editingClient) {
        payload.ownerEmail = formEmail.trim();
        payload.password = formPassword || 'Client@123';
        const res = await fetch('/api/reseller/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create client');
        toast.success(`Client "${formCompany}" onboarded successfully!`);
      } else {
        payload.id = editingClient.id;
        if (formPassword.trim()) payload.password = formPassword.trim();
        const res = await fetch('/api/reseller/clients', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update client');
        toast.success(`Client "${formCompany}" updated!`);
      }

      setShowCreateModal(false);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (client: ResellerClientItem) => {
    const nextStatus = client.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch('/api/reseller/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: client.id, status: nextStatus }),
      });
      if (!res.ok) throw new Error('Status update failed');
      toast.success(
        nextStatus === 'ACTIVE'
          ? `Activated "${client.companyName}"`
          : `Suspended "${client.companyName}"`
      );
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle status');
    }
  };

  const handleDeleteClient = async (client: ResellerClientItem) => {
    if (!confirm(`Are you sure you want to permanently delete "${client.companyName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/reseller/clients?id=${client.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete client');
      toast.success(`Client "${client.companyName}" deleted`);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const handleImpersonate = async (client: ResellerClientItem) => {
    if (client.status === 'SUSPENDED') {
      toast.error('Cannot login as a suspended client. Activate account first.');
      return;
    }

    try {
      setImpersonatingId(client.id);
      const res = await fetch(`/api/reseller/clients/${client.id}/impersonate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impersonation failed');

      toast.success(`Stepped into "${client.companyName}". Refreshing dashboard...`);
      setTimeout(() => {
        window.location.href = '/?tab=overview';
      }, 800);
    } catch (err: any) {
      toast.error(err.message || 'Failed to impersonate');
    } finally {
      setImpersonatingId(null);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Reseller Header & Top Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 day:from-blue-50 day:via-indigo-50 day:to-blue-50 p-6 rounded-2xl border border-blue-900/40 day:border-blue-200/80 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0c57e4] text-white flex items-center justify-center shadow-lg shadow-blue-900/50">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white day:text-slate-900">
                Reseller SaaS Clients & Tenants
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0c57e4]/20 border border-[#0c57e4]/40 text-blue-400 day:text-blue-700">
                White-Label Core
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 day:text-slate-600 mt-1">
              Onboard client accounts, assign WhatsApp instance quotas, allocate credits, and manage white-label branding.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchClients}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-700 day:border-slate-300 bg-slate-800/80 day:bg-white text-slate-300 day:text-slate-700 hover:text-white transition cursor-pointer"
            title="Refresh Client List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0c57e4] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/40 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard New Client</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 day:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Tenants</span>
            <Users className="w-4 h-4 text-[#0c57e4]" />
          </div>
          <div className="text-2xl font-black text-white day:text-slate-900">
            {metrics.totalClients}
          </div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>{metrics.activeClients} Active Subscriptions</span>
          </div>
        </div>

        <div className="bg-slate-900/80 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 day:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Monthly MRR</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 day:text-emerald-600">
            {formatCurrency(metrics.mrrTotal)}
          </div>
          <div className="text-[11px] text-slate-400 day:text-slate-500 mt-1">
            Recurring subscription revenue
          </div>
        </div>

        <div className="bg-slate-900/80 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 day:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Allocated Numbers</span>
            <Smartphone className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white day:text-slate-900">
            {metrics.totalInstancesAllocated}
          </div>
          <div className="text-[11px] text-slate-400 day:text-slate-500 mt-1">
            WhatsApp instance quotas
          </div>
        </div>

        <div className="bg-slate-900/80 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 day:text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Client Wallets</span>
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 day:text-amber-600">
            {formatCurrency(metrics.totalWalletBalance)}
          </div>
          <div className="text-[11px] text-slate-400 day:text-slate-500 mt-1">
            Total prepaid messaging reserve
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 day:bg-white p-3 rounded-2xl border border-slate-800 day:border-slate-200">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {[
            { key: 'ALL', label: 'All Tenants', count: metrics.totalClients },
            { key: 'ACTIVE', label: 'Active', count: metrics.activeClients },
            { key: 'TRIAL', label: 'Trial', count: metrics.trialClients },
            { key: 'SUSPENDED', label: 'Suspended', count: metrics.suspendedClients },
          ].map((pill) => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                statusFilter === pill.key
                  ? 'bg-[#0c57e4] text-white shadow-md shadow-blue-900/40'
                  : 'bg-slate-800/80 day:bg-slate-100 text-slate-400 day:text-slate-600 hover:text-white day:hover:text-slate-900'
              }`}
            >
              <span>{pill.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === pill.key
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-700 day:bg-slate-200 text-slate-300 day:text-slate-700'
              }`}>
                {pill.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, owner, email..."
            className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white day:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[#0c57e4]"
          />
        </div>
      </div>

      {/* Clients Directory Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-500 text-xs">
          <RefreshCw className="w-8 h-8 animate-spin text-[#0c57e4] mb-3" />
          <span>Loading SaaS Reseller Client Directory...</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-slate-900/40 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-2xl text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white day:text-slate-900">No Clients Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No client accounts match your active search or status filter.'
              : 'Onboard your first white-label client to allocate instances and subscription plans.'}
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 px-4 py-2 bg-[#0c57e4] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
          >
            + Onboard First Client
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/80 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 day:border-slate-200 bg-slate-950/60 day:bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-400 day:text-slate-600">
                  <th className="py-3.5 px-4">Client Organization</th>
                  <th className="py-3.5 px-4">Owner & Contact</th>
                  <th className="py-3.5 px-4">Plan & Billing</th>
                  <th className="py-3.5 px-4">Instance Quota</th>
                  <th className="py-3.5 px-4">Monthly Cap</th>
                  <th className="py-3.5 px-4">Wallet</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 day:divide-slate-200 text-xs text-slate-300 day:text-slate-700">
                {clients.map((c) => {
                  const isExpiringSoon = c.renewalDate && new Date(c.renewalDate).getTime() - Date.now() < 3600000 * 24 * 7;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-800/40 day:hover:bg-slate-50 transition-colors group"
                    >
                      {/* Organization & Slug */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0c57e4] to-blue-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {c.companyName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-white day:text-slate-900 block">
                              {c.companyName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 day:text-slate-500">
                              /{c.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Owner & Contact */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-white day:text-slate-900 block">
                          {c.ownerName}
                        </span>
                        <span className="text-[11px] text-slate-400 day:text-slate-500 block truncate max-w-[180px]">
                          {c.ownerEmail}
                        </span>
                        {c.ownerPhone && (
                          <span className="text-[10px] font-mono text-emerald-400 day:text-emerald-600 block">
                            +{c.ownerPhone}
                          </span>
                        )}
                      </td>

                      {/* Plan & Price */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            c.planName === 'Enterprise'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : c.planName === 'Growth'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : c.planName === 'Custom VIP'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-700/50 text-slate-300'
                          }`}>
                            {c.planName}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-emerald-400 day:text-emerald-600 block mt-0.5">
                          {formatCurrency(c.price)} / {c.billingCycle.toLowerCase()}
                        </span>
                        {c.renewalDate && (
                          <span className={`text-[10px] block font-mono ${
                            isExpiringSoon ? 'text-amber-400 font-bold' : 'text-slate-500'
                          }`}>
                            Renews {new Date(c.renewalDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </td>

                      {/* Instances */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-slate-200 day:text-slate-800 font-bold">
                          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                          <span>{c.maxInstances} Max</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">WhatsApp Numbers</span>
                      </td>

                      {/* Monthly Msg Cap */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-white day:text-slate-900 block">
                          {(c.monthlyMsgCap / 1000).toFixed(0)}k / mo
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          {c.hasCrmPipeline && <span title="CRM Pipeline">CRM</span>}
                          {c.hasChatbot && <span title="Chatbot Studio">• Bot</span>}
                          {c.hasMultiWarmup && <span title="Multi-Instance Warmup">• Warmup</span>}
                        </div>
                      </td>

                      {/* Wallet Balance */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-amber-400 day:text-amber-600">
                          {formatCurrency(c.walletBalance)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : c.status === 'TRIAL'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : c.status === 'SUSPENDED'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'ACTIVE' ? 'bg-emerald-400' : c.status === 'TRIAL' ? 'bg-amber-400' : 'bg-rose-400'
                          }`} />
                          {c.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1-Click Login As Client (Impersonate) */}
                          <button
                            onClick={() => handleImpersonate(c)}
                            disabled={impersonatingId === c.id || c.status === 'SUSPENDED'}
                            className="px-2.5 py-1.5 rounded-lg bg-[#0c57e4] hover:bg-blue-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition cursor-pointer disabled:opacity-50"
                            title="Login to this client's dashboard"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>Login</span>
                          </button>

                          {/* Edit Client */}
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 day:bg-slate-100 day:hover:bg-slate-200 text-slate-300 day:text-slate-700 transition cursor-pointer"
                            title="Edit Plan & Resource Limits"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Suspended */}
                          <button
                            onClick={() => handleToggleStatus(c)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              c.status === 'ACTIVE'
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                            }`}
                            title={c.status === 'ACTIVE' ? 'Suspend Client' : 'Activate Client'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteClient(c)}
                            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                            title="Delete Client"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onboard / Edit Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 day:border-slate-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0c57e4]" />
                <h3 className="font-bold text-sm text-white day:text-slate-900">
                  {editingClient ? `Edit Client: ${editingClient.companyName}` : 'Onboard New White-Label Client'}
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-white day:hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
              {/* Company & Owner Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Company Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="e.g. Acme Retailers Ltd"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900 focus:outline-none focus:border-[#0c57e4]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Owner / Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formOwnerName}
                    onChange={(e) => setFormOwnerName(e.target.value)}
                    placeholder="e.g. Vikram Malhotra"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900 focus:outline-none focus:border-[#0c57e4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Owner Email (Login ID) *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingClient)}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900 focus:outline-none focus:border-[#0c57e4] disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    WhatsApp Phone Number
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 919876543210"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900 focus:outline-none focus:border-[#0c57e4]"
                  />
                </div>
              </div>

              {!editingClient && (
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Initial Password
                  </label>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Client@123"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900 font-mono focus:outline-none focus:border-[#0c57e4]"
                  />
                </div>
              )}

              {/* Plan Selection Preset */}
              <div className="pt-2 border-t border-slate-800 day:border-slate-200">
                <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1.5">
                  Subscription Tier & Preset
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DEFAULT_PLANS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handlePlanChange(p.name)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        formPlan === p.name
                          ? 'bg-[#0c57e4]/20 border-[#0c57e4] text-white day:text-slate-900'
                          : 'bg-slate-950/60 day:bg-slate-50 border-slate-800 day:border-slate-200 text-slate-400'
                      }`}
                    >
                      <span className="font-bold block text-xs">{p.name}</span>
                      <span className="text-[11px] font-mono font-semibold text-emerald-400">
                        {formatCurrency(p.price)}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {p.instances} {p.instances === 1 ? 'Number' : 'Numbers'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quotas & Limits */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Max Numbers
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formMaxInstances}
                    onChange={(e) => setFormMaxInstances(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Contacts Cap
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="1000"
                    value={formMaxContacts}
                    onChange={(e) => setFormMaxContacts(parseInt(e.target.value, 10) || 5000)}
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Monthly Msg Cap
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="5000"
                    value={formMonthlyCap}
                    onChange={(e) => setFormMonthlyCap(parseInt(e.target.value, 10) || 10000)}
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Wallet Credit (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formWallet}
                    onChange={(e) => setFormWallet(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900"
                  />
                </div>
              </div>

              {/* Feature Flags */}
              <div className="pt-2 border-t border-slate-800 day:border-slate-200">
                <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1.5">
                  Enabled Feature Modules
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 bg-slate-950/60 day:bg-slate-50 p-2.5 rounded-xl border border-slate-800 day:border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHasCrm}
                      onChange={(e) => setFormHasCrm(e.target.checked)}
                      className="rounded text-[#0c57e4] focus:ring-[#0c57e4]"
                    />
                    <span className="text-[11px] font-medium text-slate-300 day:text-slate-700">CRM Sales Pipeline</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-950/60 day:bg-slate-50 p-2.5 rounded-xl border border-slate-800 day:border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHasChatbot}
                      onChange={(e) => setFormHasChatbot(e.target.checked)}
                      className="rounded text-[#0c57e4] focus:ring-[#0c57e4]"
                    />
                    <span className="text-[11px] font-medium text-slate-300 day:text-slate-700">Chatbot Studio Flow</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-950/60 day:bg-slate-50 p-2.5 rounded-xl border border-slate-800 day:border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHasWarmup}
                      onChange={(e) => setFormHasWarmup(e.target.checked)}
                      className="rounded text-[#0c57e4] focus:ring-[#0c57e4]"
                    />
                    <span className="text-[11px] font-medium text-slate-300 day:text-slate-700">Multi-Instance Warmup</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-950/60 day:bg-slate-50 p-2.5 rounded-xl border border-slate-800 day:border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHasDam}
                      onChange={(e) => setFormHasDam(e.target.checked)}
                      className="rounded text-[#0c57e4] focus:ring-[#0c57e4]"
                    />
                    <span className="text-[11px] font-medium text-slate-300 day:text-slate-700">DAM Media Library</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-950/60 day:bg-slate-50 p-2.5 rounded-xl border border-slate-800 day:border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHasAi}
                      onChange={(e) => setFormHasAi(e.target.checked)}
                      className="rounded text-[#0c57e4] focus:ring-[#0c57e4]"
                    />
                    <span className="text-[11px] font-medium text-slate-300 day:text-slate-700">AI Auto-Responders</span>
                  </label>
                </div>
              </div>

              {/* Status and Custom Domain */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Account Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e: any) => setFormStatus(e.target.value)}
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900"
                  >
                    <option value="ACTIVE">ACTIVE (Full Access)</option>
                    <option value="TRIAL">TRIAL (Evaluation Mode)</option>
                    <option value="SUSPENDED">SUSPENDED (Locked)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 day:text-slate-600 font-semibold mb-1">
                    Custom White-Label Domain (Optional)
                  </label>
                  <input
                    type="text"
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    placeholder="e.g. app.acmeretail.com"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-xl px-3 py-2 text-white day:text-slate-900"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800 day:border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 day:border-slate-300 text-slate-300 day:text-slate-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#0c57e4] hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-900/40 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingClient ? 'Save Changes' : 'Onboard Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
