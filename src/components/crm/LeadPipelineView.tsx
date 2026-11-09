'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Kanban,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  Target,
  Trophy,
  Users,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Phone,
  Tag,
  Clock,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface LeadDeal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: 'NEW_LEAD' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
  contactName: string | null;
  contactPhone: string;
  tags: string | null;
  notes: string | null;
  assignedTo: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
}

export const PIPELINE_STAGES: Array<{
  id: LeadDeal['stage'];
  label: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}> = [
  {
    id: 'NEW_LEAD',
    label: 'New Leads',
    description: 'Fresh inbound inquiries & imports',
    color: 'border-blue-500/40 bg-blue-500/5',
    badgeBg: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
    badgeText: 'text-blue-400',
    borderColor: 'border-blue-500',
  },
  {
    id: 'CONTACTED',
    label: 'Contacted',
    description: 'First touch & follow-ups ongoing',
    color: 'border-indigo-500/40 bg-indigo-500/5',
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30',
    badgeText: 'text-indigo-400',
    borderColor: 'border-indigo-500',
  },
  {
    id: 'QUALIFIED',
    label: 'Qualified',
    description: 'High purchase intent & budget verified',
    color: 'border-amber-500/40 bg-amber-500/5',
    badgeBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
    badgeText: 'text-amber-400',
    borderColor: 'border-amber-500',
  },
  {
    id: 'PROPOSAL',
    label: 'Proposal Sent',
    description: 'Offer presented, negotiating terms',
    color: 'border-purple-500/40 bg-purple-500/5',
    badgeBg: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
    badgeText: 'text-purple-400',
    borderColor: 'border-purple-500',
  },
  {
    id: 'WON',
    label: 'Deals Won',
    description: 'Payment collected, customer closed',
    color: 'border-emerald-500/40 bg-emerald-500/5',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    badgeText: 'text-emerald-400',
    borderColor: 'border-emerald-500',
  },
];

interface LeadPipelineViewProps {
  onOpenWhatsAppChat?: (phone: string) => void;
}

export function LeadPipelineView({ onOpenWhatsAppChat }: LeadPipelineViewProps) {
  const [deals, setDeals] = useState<LeadDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formValue, setFormValue] = useState('15000');
  const [formStage, setFormStage] = useState<LeadDeal['stage']>('NEW_LEAD');
  const [formPriority, setFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [formTags, setFormTags] = useState('Lead, Inbound');
  const [formNotes, setFormNotes] = useState('');
  const [formAssignee, setFormAssignee] = useState('Paramveer (Admin)');

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.success && Array.isArray(data.deals)) {
        setDeals(data.deals);
      }
    } catch (err: any) {
      toast.error('Failed to load lead pipeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  // Filtered Deals
  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        d.title.toLowerCase().includes(q) ||
        (d.contactName && d.contactName.toLowerCase().includes(q)) ||
        d.contactPhone.includes(q) ||
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        (d.tags && d.tags.toLowerCase().includes(q));

      const matchPriority = priorityFilter === 'ALL' || d.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [deals, searchQuery, priorityFilter]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const totalValue = deals.reduce((acc, d) => acc + (d.value || 0), 0);
    const wonDeals = deals.filter((d) => d.stage === 'WON');
    const wonValue = wonDeals.reduce((acc, d) => acc + (d.value || 0), 0);
    const qualifiedCount = deals.filter((d) => d.stage === 'QUALIFIED').length;
    const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;

    return {
      totalDeals: deals.length,
      totalValue,
      wonCount: wonDeals.length,
      wonValue,
      qualifiedCount,
      winRate,
    };
  }, [deals]);

  // Move Deal Stage
  const handleMoveStage = async (dealId: string, newStage: LeadDeal['stage']) => {
    // Optimistic Update
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: newStage, updatedAt: new Date().toISOString() } : d))
    );

    try {
      const res = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId, stage: newStage }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error('Failed to update stage');
        fetchDeals(); // Revert
      } else {
        toast.success(`Deal moved to ${PIPELINE_STAGES.find((s) => s.id === newStage)?.label}`);
      }
    } catch {
      toast.error('Network error moving deal');
      fetchDeals();
    }
  };

  // Delete Deal
  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    try {
      await fetch(`/api/leads?id=${dealId}`, { method: 'DELETE' });
      toast.success('Deal deleted');
    } catch {
      toast.error('Failed to delete deal');
      fetchDeals();
    }
  };

  // Add Deal Submit
  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formPhone) {
      toast.error('Please enter a title and contact phone number');
      return;
    }

    try {
      setSaving(true);
      const tagsArray = formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          contactName: formName,
          contactPhone: formPhone,
          value: parseFloat(formValue) || 0,
          stage: formStage,
          priority: formPriority,
          tags: tagsArray,
          notes: formNotes,
          assignedTo: formAssignee,
        }),
      });

      const data = await res.json();
      if (data.success && data.deal) {
        setDeals((prev) => [data.deal, ...prev]);
        toast.success('New deal created in pipeline!');
        setShowAddModal(false);
        // Reset form
        setFormTitle('');
        setFormName('');
        setFormPhone('');
        setFormNotes('');
      } else {
        toast.error(data.error || 'Failed to create deal');
      }
    } catch {
      toast.error('Network error creating deal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card (Inspired by Zolo Suit Portal) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Kanban className="w-3.5 h-3.5" />
              CRM & Leads Management
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Lead Sales Pipeline
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
              {stats.totalDeals} Deals
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track lead lifecycle stages from first WhatsApp outreach to won contracts.
          </p>
        </div>

        {/* Quick Actions & Add Deal */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>New Lead Deal</span>
          </button>
        </div>
      </div>

      {/* Pipeline Metrics Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 1: Total Pipeline Value */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pipeline Value</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tabular-nums">
            ₹{stats.totalValue.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Across {stats.totalDeals} active deals</span>
        </div>

        {/* Metric 2: Deals Won Value */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Revenue Won</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
            ₹{stats.wonValue.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">{stats.wonCount} deals successfully closed</span>
        </div>

        {/* Metric 3: Qualified Prospects */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Qualified Leads</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white font-mono tabular-nums">{stats.qualifiedCount}</div>
          <span className="text-[10px] text-slate-400 mt-1 block">High buyer intent prospects</span>
        </div>

        {/* Metric 4: Win Conversion Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Win Rate</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono tabular-nums">{stats.winRate}%</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Lead to won conversion ratio</span>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search deals, contacts, phone, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Priority:
          </span>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  priorityFilter === p ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5-Column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4 items-start">
        {PIPELINE_STAGES.map((stageInfo, stageIdx) => {
          const stageDeals = filteredDeals.filter((d) => d.stage === stageInfo.id);
          const stageValue = stageDeals.reduce((acc, d) => acc + (d.value || 0), 0);

          return (
            <div
              key={stageInfo.id}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 min-w-[260px] flex flex-col gap-3 shadow-md"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${stageInfo.borderColor.replace('border-', 'bg-')}`}></span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">{stageInfo.label}</h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-bold">
                    {stageDeals.length}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-400">
                  ₹{stageValue.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-3 min-h-[380px]">
                {stageDeals.length === 0 ? (
                  <div className="h-44 border-2 border-dashed border-slate-800/80 rounded-xl flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-xs text-slate-500 font-medium">No deals in this stage</span>
                    <button
                      onClick={() => {
                        setFormStage(stageInfo.id);
                        setShowAddModal(true);
                      }}
                      className="mt-2 text-[11px] text-emerald-400 hover:text-emerald-300 font-bold"
                    >
                      + Add Deal
                    </button>
                  </div>
                ) : (
                  stageDeals.map((deal) => {
                    let parsedTags: string[] = [];
                    try {
                      parsedTags = Array.isArray(deal.tags)
                        ? deal.tags
                        : JSON.parse(deal.tags || '[]');
                    } catch {
                      parsedTags = deal.tags ? [deal.tags] : [];
                    }

                    return (
                      <div
                        key={deal.id}
                        className="bg-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3.5 shadow-sm transition hover:shadow-md flex flex-col justify-between group"
                      >
                        {/* Priority Badge & Value */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-md ${
                              deal.priority === 'HIGH'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : deal.priority === 'MEDIUM'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {deal.priority} PRIORITY
                          </span>
                          <span className="text-xs font-black font-mono text-emerald-400 tabular-nums">
                            ₹{deal.value.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-bold text-white line-clamp-2 mb-1.5">{deal.title}</h4>

                        {/* Contact Name & Phone */}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mb-2 font-medium">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{deal.contactName || 'Anonymous Contact'}</span>
                          <span className="text-[10px] text-slate-400 font-mono filter-privacy">
                            ({deal.contactPhone})
                          </span>
                        </div>

                        {/* Tags */}
                        {parsedTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2.5">
                            {parsedTags.map((t, tidx) => (
                              <span
                                key={tidx}
                                className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-900 border border-slate-800 text-slate-400"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Notes Preview */}
                        {deal.notes && (
                          <p className="text-[10px] text-slate-400 bg-slate-900/60 rounded-lg p-2 mb-3 line-clamp-2 border border-slate-800/40">
                            {deal.notes}
                          </p>
                        )}

                        {/* Card Footer with Move Actions & WhatsApp Trigger */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-xs">
                          {/* Left: Quick WhatsApp Chat Action */}
                          <button
                            onClick={() => {
                              if (onOpenWhatsAppChat) {
                                onOpenWhatsAppChat(deal.contactPhone);
                              } else {
                                window.open(`https://wa.me/${deal.contactPhone}`, '_blank');
                              }
                            }}
                            className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg transition"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </button>

                          {/* Right: Stage Advancement Navigation */}
                          <div className="flex items-center gap-1">
                            {stageIdx > 0 && (
                              <button
                                onClick={() => handleMoveStage(deal.id, PIPELINE_STAGES[stageIdx - 1].id)}
                                className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                                title={`Move backward to ${PIPELINE_STAGES[stageIdx - 1].label}`}
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                            )}

                            {stageIdx < PIPELINE_STAGES.length - 1 && (
                              <button
                                onClick={() => handleMoveStage(deal.id, PIPELINE_STAGES[stageIdx + 1].id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition font-bold text-[10px]"
                                title={`Advance to ${PIPELINE_STAGES[stageIdx + 1].label}`}
                              >
                                <span>Move</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteDeal(deal.id)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                              title="Delete deal"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Deal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Kanban className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Create New Lead Deal</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Deal Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Software Subscription or Bulk Order"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">WhatsApp Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 919876543210"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Deal Value (₹)</label>
                  <input
                    type="number"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Pipeline Stage</label>
                  <select
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. VIP, E-Commerce, Urgent"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Notes & Follow-up Details</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Lead requested a pricing sheet and product demo via WhatsApp."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  {saving ? 'Creating...' : 'Create Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
