'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Send, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Mail, 
  ExternalLink, 
  Tag as TagIcon, 
  Layers, 
  ChevronRight, 
  X, 
  RefreshCw,
  MessageCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { api } from '@/lib/api';

interface LeadRecord {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  tag?: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  form?: {
    id: string;
    title: string;
    slug: string;
  } | null;
}

interface LeadCrmViewProps {
  onLaunchCampaign?: (leads: Array<{ name: string; phone: string; customFields: Record<string, any> }>) => void;
}

export function LeadCrmView({ onLaunchCampaign }: LeadCrmViewProps) {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [forms, setForms] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    new: 0,
    contacted: 0,
    qualified: 0,
    closed: 0,
  });

  // Filters State
  const [selectedFormId, setSelectedFormId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Custom Fields Drawer Modal
  const [activeLeadDetails, setActiveLeadDetails] = useState<LeadRecord | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedFormId !== 'all') params.set('form_id', selectedFormId);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedTag !== 'all') params.set('tag', selectedTag);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await api.get(`/api/leads?${params.toString()}`);
      if (res?.success || res?.data?.success) {
        setLeads(res.leads || res.data?.leads || []);
        const counts = res.statusCounts || res.data?.statusCounts;
        if (counts) {
          setStatusCounts(counts);
        }
      }
    } catch {
      toast.error('Failed to load CRM leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchForms = async () => {
    try {
      const res = await api.get('/api/forms');
      if (res?.success || res?.data?.success) {
        setForms(res.forms || res.data?.forms || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchForms();
  }, []);

  useEffect(() => {
    fetchLeads();
    setSelectedIds(new Set());
  }, [selectedFormId, selectedStatus, selectedTag]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Checkbox Selection
  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Status Change (PATCH)
  const handleStatusChange = async (leadId: string, newStatus: LeadRecord['status']) => {
    try {
      const res = await api.patch(`/api/leads/${leadId}`, { status: newStatus });
      if (res?.success || res?.data?.success) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
        );
        toast.success(`Lead marked as ${newStatus.toUpperCase()}`);
      }
    } catch {
      toast.error('Failed to update lead status');
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected leads?`)) return;

    try {
      const res = await api.delete('/api/leads', { ids: Array.from(selectedIds) });
      if (res?.success || res?.data?.success) {
        toast.success(res.message || res.data?.message || 'Leads deleted');
        setSelectedIds(new Set());
        fetchLeads();
      }
    } catch {
      toast.error('Failed to delete leads');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedFormId !== 'all') params.set('form_id', selectedFormId);
    if (selectedStatus !== 'all') params.set('status', selectedStatus);
    if (selectedTag !== 'all') params.set('tag', selectedTag);
    if (searchQuery.trim()) params.set('search', searchQuery.trim());

    window.open(`/api/leads/export?${params.toString()}`, '_blank');
  };

  // Send WhatsApp Bulk Campaign with Selected Leads
  const handleSendCampaign = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least 1 lead to launch a WhatsApp campaign.');
      return;
    }

    const selectedLeads = leads
      .filter((l) => selectedIds.has(l.id))
      .map((l) => ({
        name: l.name,
        phone: l.phone,
        customFields: {
          ...l.customFields,
          email: l.email || '',
          sourceForm: l.form?.title || '',
          status: l.status,
          tag: l.tag || '',
        },
      }));

    if (onLaunchCampaign) {
      onLaunchCampaign(selectedLeads);
    } else {
      toast.success(`Handed off ${selectedLeads.length} leads to Bulk Campaign Wizard!`);
    }
  };

  const totalLeadsCount =
    (statusCounts.new || 0) +
    (statusCounts.contacted || 0) +
    (statusCounts.qualified || 0) +
    (statusCounts.closed || 0);

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-slate-400 uppercase">Total Leads</p>
            <p className="text-xl font-bold font-mono text-white mt-1">{totalLeadsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-sky-400 uppercase">New Inquiries</p>
            <p className="text-xl font-bold font-mono text-white mt-1">{statusCounts.new || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-amber-400 uppercase">Contacted</p>
            <p className="text-xl font-bold font-mono text-white mt-1">{statusCounts.contacted || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono text-emerald-400 uppercase">Qualified</p>
            <p className="text-xl font-bold font-mono text-white mt-1">{statusCounts.qualified || 0}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by name, phone, or email..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Source Form Filter */}
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Source Forms</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="closed">Closed</option>
            </select>

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Export Filtered Leads as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Selected Leads Action Floating Banner */}
        {selectedIds.size > 0 && (
          <div className="p-3 bg-indigo-950/60 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <span className="text-xs font-semibold text-indigo-300">
              {selectedIds.size} {selectedIds.size === 1 ? 'lead' : 'leads'} selected
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSendCampaign}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                Send WhatsApp Campaign
              </button>

              <button
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DATA TABLE */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3.5 pl-4 pr-2 w-10">
                  <input
                    type="checkbox"
                    checked={leads.length > 0 && selectedIds.size === leads.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                  />
                </th>
                <th className="py-3.5 px-3">Lead Contact</th>
                <th className="py-3.5 px-3">WhatsApp Number</th>
                <th className="py-3.5 px-3">Source Form</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Custom Responses</th>
                <th className="py-3.5 px-3">Received At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading CRM leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  const customKeys = Object.keys(lead.customFields || {});

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(lead.id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600"
                        />
                      </td>

                      {/* Name & Email */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-white">{lead.name}</div>
                        {lead.email && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{lead.email}</span>
                          </div>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-3 font-mono">
                        <a
                          href={`https://wa.me/${lead.phone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-1.5"
                          title="Open WhatsApp chat"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>+{lead.phone}</span>
                        </a>
                      </td>

                      {/* Source Form & Tag */}
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-300">
                          {lead.form?.title || 'Direct/Manual'}
                        </div>
                        {lead.tag && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono mt-1">
                            #{lead.tag}
                          </span>
                        )}
                      </td>

                      {/* Interactive Status Selector */}
                      <td className="py-3.5 px-3">
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            handleStatusChange(lead.id, e.target.value as LeadRecord['status'])
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider focus:outline-none cursor-pointer border ${
                            lead.status === 'new'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : lead.status === 'contacted'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : lead.status === 'qualified'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          <option value="new" className="bg-slate-900 text-white">NEW</option>
                          <option value="contacted" className="bg-slate-900 text-white">CONTACTED</option>
                          <option value="qualified" className="bg-slate-900 text-white">QUALIFIED</option>
                          <option value="closed" className="bg-slate-900 text-white">CLOSED</option>
                        </select>
                      </td>

                      {/* Custom Responses Pills */}
                      <td className="py-3.5 px-3">
                        {customKeys.length === 0 ? (
                          <span className="text-slate-500 text-[11px]">None</span>
                        ) : (
                          <button
                            onClick={() => setActiveLeadDetails(lead)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] inline-flex items-center gap-1 transition-colors"
                          >
                            <span>{customKeys.length} {customKeys.length === 1 ? 'Field' : 'Fields'}</span>
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          </button>
                        )}
                      </td>

                      {/* Received Date */}
                      <td className="py-3.5 px-3 text-[11px] text-slate-400 font-mono">
                        {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LEAD DETAILS DRAWER MODAL */}
      {activeLeadDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setActiveLeadDetails(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-1">
              {activeLeadDetails.name}
            </h3>
            <p className="text-xs text-slate-400 font-mono mb-4">
              +{activeLeadDetails.phone} • {activeLeadDetails.form?.title || 'Direct'}
            </p>

            <div className="space-y-3 pt-3 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Custom Form Answers
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {Object.entries(activeLeadDetails.customFields || {}).map(([key, val]) => (
                  <div key={key} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
                    <p className="text-[10px] font-mono text-slate-400 uppercase">{key}</p>
                    <p className="text-xs text-white font-medium mt-0.5">{String(val)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
