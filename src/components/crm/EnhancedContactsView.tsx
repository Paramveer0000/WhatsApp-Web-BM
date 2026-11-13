'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Download,
  Upload,
  Calendar,
  Phone,
  Tag as TagIcon,
  Bell,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  MessageSquare,
  ArrowUpDown,
  ExternalLink,
  ChevronDown,
  X,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface ContactRecord {
  id: string;
  phone: string;
  name: string | null;
  customFields: string | null;
  tags: string | null;
  optInStatus: boolean;
  isBlacklisted: boolean;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  listNames?: string[];
  listIds?: string[];
  assignedTo?: string | null;
  accountInstance?: string | null;
}

export interface CustomColumnDef {
  id: string;
  name: string;
  key: string;
  type: string;
  isVisible: boolean;
}

interface EnhancedContactsViewProps {
  onOpenWhatsAppChat?: (phone: string) => void;
  onOpenQuickReminder?: (phone: string, name?: string) => void;
  availableLists?: Array<{ id: string; name: string }>;
  instances?: Array<{ name: string; phone?: string | null }>;
}

export function EnhancedContactsView({
  onOpenWhatsAppChat,
  onOpenQuickReminder,
  availableLists = [],
  instances = [],
}: EnhancedContactsViewProps) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumnDef[]>([]);
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('ALL');
  const [selectedOptInFilter, setSelectedOptInFilter] = useState<string>('ALL');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('ALL');

  // Sorting State
  const [sortField, setSortField] = useState<'createdAt' | 'name' | 'phone'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderContact, setReminderContact] = useState<{ phone: string; name?: string } | null>(null);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDate, setReminderDate] = useState('');

  // Add Contact Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSource, setFormSource] = useState('Manual');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formCustomFields, setFormCustomFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Contacts, Smart Columns, and Tags
  const loadData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [cRes, colRes, tagRes] = await Promise.all([
        fetch('/api/contacts?limit=2000'),
        fetch('/api/crm/columns'),
        fetch('/api/crm/tags'),
      ]);

      const [cData, colData, tagData] = await Promise.all([
        cRes.json(),
        colRes.json(),
        tagRes.json(),
      ]);

      if (cData.success && Array.isArray(cData.contacts)) {
        setContacts(cData.contacts);
      }
      if (colData.success && Array.isArray(colData.columns)) {
        setCustomColumns(colData.columns.filter((c: any) => c.isVisible));
      }
      if (tagData.success && Array.isArray(tagData.tags)) {
        setAvailableTags(tagData.tags);
      }
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered & Sorted Contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      let matchSearch = true;
      if (q) {
        const nameMatch = c.name?.toLowerCase().includes(q);
        const phoneMatch = c.phone.includes(q);
        const sourceMatch = c.source?.toLowerCase().includes(q);
        const tagsMatch = c.tags?.toLowerCase().includes(q);
        const customMatch = c.customFields?.toLowerCase().includes(q);
        matchSearch = Boolean(nameMatch || phoneMatch || sourceMatch || tagsMatch || customMatch);
      }

      // Tag Filter
      let matchTag = true;
      if (selectedTagFilter !== 'ALL') {
        let parsedTags: string[] = [];
        try {
          parsedTags = typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags;
        } catch {
          parsedTags = c.tags ? String(c.tags).split(',').map((s) => s.trim()) : [];
        }
        matchTag = Array.isArray(parsedTags) && parsedTags.includes(selectedTagFilter);
      }

      // Source Filter
      let matchSource = true;
      if (selectedSourceFilter !== 'ALL') {
        matchSource = (c.source || 'Manual').toUpperCase() === selectedSourceFilter.toUpperCase();
      }

      // OptIn Filter
      let matchOptIn = true;
      if (selectedOptInFilter === 'OPTED_IN') matchOptIn = c.optInStatus === true;
      else if (selectedOptInFilter === 'OPTED_OUT') matchOptIn = c.optInStatus === false;

      return matchSearch && matchTag && matchSource && matchOptIn;
    }).sort((a, b) => {
      if (sortField === 'name') {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else if (sortField === 'phone') {
        return sortOrder === 'asc' ? a.phone.localeCompare(b.phone) : b.phone.localeCompare(a.phone);
      } else {
        // createdAt
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });
  }, [
    contacts,
    searchQuery,
    selectedTagFilter,
    selectedSourceFilter,
    selectedOptInFilter,
    sortField,
    sortOrder,
  ]);

  // Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Sort Toggle
  const toggleSort = (field: 'createdAt' | 'name' | 'phone') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Export to CSV matching active dynamic columns
  const handleExportCSV = () => {
    if (filteredContacts.length === 0) {
      toast.warning('No contacts to export');
      return;
    }

    const headers = [
      'Phone',
      'Name',
      'Source',
      'OptedIn',
      'Tags',
      'Created Date',
      ...customColumns.map((c) => c.name),
    ];

    const rows = filteredContacts.map((c) => {
      let customMap: Record<string, any> = {};
      try {
        customMap = typeof c.customFields === 'string' ? JSON.parse(c.customFields) : c.customFields || {};
      } catch {}

      let tagsStr = '';
      try {
        const p = typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags;
        tagsStr = Array.isArray(p) ? p.join('; ') : String(c.tags || '');
      } catch {
        tagsStr = c.tags || '';
      }

      return [
        `"${c.phone}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${c.source || 'Manual'}"`,
        c.optInStatus ? 'Yes' : 'No',
        `"${tagsStr.replace(/"/g, '""')}"`,
        `"${new Date(c.createdAt).toLocaleDateString()}"`,
        ...customColumns.map((col) => `"${String(customMap[col.key] || customMap[col.name] || '').replace(/"/g, '""')}"`),
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `contacts_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredContacts.length} contacts to CSV`, 'Export Complete');
  };

  // Import handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('listName', 'Imported Contacts');

    try {
      toast.info('Uploading and parsing contact database...');
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to import file');

      toast.success(`Successfully imported ${data.count || 'contacts'}!`, 'Import Finished');
      loadData(true);
    } catch (err: any) {
      toast.error(err.message, 'Import Failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add Contact Handler
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPhone.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formPhone.trim(),
          name: formName.trim() || undefined,
          source: formSource,
          tags: formTags,
          customFields: formCustomFields,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save contact');

      toast.success(`Contact ${formName || formPhone} added!`, 'Contact Created');
      setShowAddModal(false);
      setFormName('');
      setFormPhone('');
      setFormCustomFields({});
      setFormTags([]);
      loadData(true);
    } catch (err: any) {
      toast.error(err.message, 'Save Failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Schedule Quick Reminder
  const handleScheduleReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderContact || !reminderTitle.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reminderTitle.trim(),
          contactPhone: reminderContact.phone,
          dueDate: reminderDate || new Date(Date.now() + 86400000).toISOString(),
          priority: 'MEDIUM',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to set reminder');

      toast.success(`Reminder set for ${reminderContact.name || reminderContact.phone}!`, 'Reminder Created');
      setShowReminderModal(false);
      setReminderTitle('');
    } catch (err: any) {
      toast.error(err.message, 'Reminder Error');
    }
  };

  // Avatar initial color generator
  const getAvatarBg = (name?: string | null, phone?: string) => {
    const str = name || phone || 'A';
    const colors = [
      'bg-blue-600',
      'bg-indigo-600',
      'bg-emerald-600',
      'bg-purple-600',
      'bg-amber-600',
      'bg-rose-600',
      'bg-cyan-600',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
    return colors[hash % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header matching Zolo Suit Contacts */}
      <div>
        <div className="text-[11px] font-medium text-slate-400 day:text-slate-500 mb-1 flex items-center gap-1.5">
          <span>Dashboard</span>
          <span>&gt;</span>
          <span className="text-white day:text-slate-900 font-semibold">Contacts</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0c57e4] flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white day:text-slate-900">
                Contacts
              </h1>
              <p className="text-xs text-slate-400 day:text-slate-600">
                Manage and organize your CRM database
              </p>
            </div>
          </div>

          {/* Action Buttons (Matching Screenshot) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowGuideModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 day:bg-slate-100 day:hover:bg-slate-200 text-slate-200 day:text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-700 day:border-slate-300"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Import & Export Guide</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 day:bg-slate-100 day:hover:bg-slate-200 text-slate-200 day:text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-700 day:border-slate-300"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Import</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 day:bg-slate-100 day:hover:bg-slate-200 text-slate-200 day:text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer border border-slate-700 day:border-slate-300"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>Export</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0c57e4] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-900/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Contact</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar (Matching Zolo Suit) */}
      <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full max-w-lg">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name, phone, source or custom..."
              className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-[#0c57e4] transition"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Filter Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowFilterPopover(!showFilterPopover)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  selectedTagFilter !== 'ALL' || selectedSourceFilter !== 'ALL' || selectedOptInFilter !== 'ALL'
                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                    : 'bg-slate-800 day:bg-slate-100 border-slate-700 day:border-slate-300 text-slate-300 day:text-slate-700'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {/* Filter Dropdown Popover */}
              {showFilterPopover && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-4 shadow-2xl z-30 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 day:border-slate-200">
                    <span className="font-bold text-white day:text-slate-900">Filter Contacts</span>
                    <button
                      onClick={() => {
                        setSelectedTagFilter('ALL');
                        setSelectedSourceFilter('ALL');
                        setSelectedOptInFilter('ALL');
                      }}
                      className="text-[10px] text-blue-400 hover:underline"
                    >
                      Reset All
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">CRM Tag</label>
                    <select
                      value={selectedTagFilter}
                      onChange={(e) => setSelectedTagFilter(e.target.value)}
                      className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-lg p-2 text-white day:text-slate-900"
                    >
                      <option value="ALL">All Tags</option>
                      {availableTags.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Acquisition Source</label>
                    <select
                      value={selectedSourceFilter}
                      onChange={(e) => setSelectedSourceFilter(e.target.value)}
                      className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-lg p-2 text-white day:text-slate-900"
                    >
                      <option value="ALL">All Sources</option>
                      <option value="API">API</option>
                      <option value="WHATSAPP">WhatsApp Inbound</option>
                      <option value="MANUAL">Manual Entry</option>
                      <option value="CSV">CSV / Excel Import</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">WhatsApp Opt-In Status</label>
                    <select
                      value={selectedOptInFilter}
                      onChange={(e) => setSelectedOptInFilter(e.target.value)}
                      className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-lg p-2 text-white day:text-slate-900"
                    >
                      <option value="ALL">All</option>
                      <option value="OPTED_IN">Opted In (Active)</option>
                      <option value="OPTED_OUT">Opted Out (Unsubscribed)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Records Counter */}
            <span className="text-xs font-mono text-slate-400 day:text-slate-600">
              {filteredContacts.length} records found
            </span>

            {/* Refresh Button */}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 day:bg-slate-100 day:hover:bg-slate-200 text-slate-300 day:text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Selected Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
            <span className="font-semibold text-blue-400">
              {selectedIds.size} contact{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-2.5 py-1 bg-[#0c57e4] text-white rounded-lg font-bold text-[11px]"
              >
                Export Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-[11px]"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Table (Matching Zolo Suit Image 1 Columns & Layout) */}
      <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-950/80 day:bg-slate-100 text-slate-400 day:text-slate-600 font-semibold border-b border-slate-800 day:border-slate-200 select-none">
              <tr>
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={filteredContacts.length > 0 && selectedIds.size === filteredContacts.length}
                    onChange={handleToggleSelectAll}
                    className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-[#0c57e4] cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => toggleSort('createdAt')}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Added</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('phone')}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>Phone</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3">Reminder</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-3">Opted In</th>
                <th className="py-3 px-3">Accounts</th>
                <th className="py-3 px-3">Assigned To</th>
                <th className="py-3 px-3">Tags</th>

                {/* Dynamic Smart Columns (Matching 'test' from screenshot!) */}
                {customColumns.map((col) => (
                  <th key={col.id} className="py-3 px-3 font-semibold text-blue-400">
                    <div className="flex items-center gap-1">
                      <span>{col.name}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>
                ))}

                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-850 day:divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={11 + customColumns.length} className="py-12 text-center text-slate-500">
                    Loading contact database...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={11 + customColumns.length} className="py-12 text-center text-slate-500">
                    No contacts found matching the search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => {
                  let parsedTags: string[] = [];
                  try {
                    parsedTags = typeof contact.tags === 'string' ? JSON.parse(contact.tags) : contact.tags;
                  } catch {
                    parsedTags = contact.tags ? String(contact.tags).split(',').map((s) => s.trim()) : [];
                  }
                  if (!Array.isArray(parsedTags)) parsedTags = [];

                  let customMap: Record<string, any> = {};
                  try {
                    customMap = typeof contact.customFields === 'string'
                      ? JSON.parse(contact.customFields)
                      : contact.customFields || {};
                  } catch {}

                  const isSelected = selectedIds.has(contact.id);
                  const initial = (contact.name || contact.phone || '?').slice(0, 2).toUpperCase();

                  return (
                    <tr
                      key={contact.id}
                      className={`hover:bg-slate-850/50 day:hover:bg-slate-50 transition ${
                        isSelected ? 'bg-blue-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(contact.id)}
                          className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-[#0c57e4] cursor-pointer"
                        />
                      </td>

                      {/* Added Date */}
                      <td className="py-3 px-3 text-slate-400 day:text-slate-600 font-mono text-[11px]">
                        <div>{new Date(contact.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="text-[10px] text-slate-500">{new Date(contact.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      {/* Name with Avatar circle */}
                      <td className="py-3 px-3 font-medium text-white day:text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm ${getAvatarBg(
                              contact.name,
                              contact.phone
                            )}`}
                          >
                            {initial}
                          </div>
                          <span className="font-semibold truncate max-w-[140px]">
                            {contact.name || contact.phone}
                          </span>
                        </div>
                      </td>

                      {/* Phone with WhatsApp link */}
                      <td className="py-3 px-3 font-mono text-[11px]">
                        <button
                          onClick={() => {
                            if (onOpenWhatsAppChat) onOpenWhatsAppChat(contact.phone);
                            else window.open(`https://wa.me/${contact.phone}`, '_blank');
                          }}
                          className="text-slate-300 day:text-slate-700 hover:text-emerald-400 flex items-center gap-1 transition"
                          title="Open WhatsApp"
                        >
                          <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{contact.phone}</span>
                        </button>
                      </td>

                      {/* Reminder */}
                      <td className="py-3 px-3">
                        <button
                          onClick={() => {
                            setReminderContact({ phone: contact.phone, name: contact.name || undefined });
                            setReminderTitle(`Follow-up with ${contact.name || contact.phone}`);
                            setShowReminderModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-medium transition cursor-pointer"
                        >
                          <Bell className="w-3 h-3 text-amber-400" />
                          <span>+ Set Reminder</span>
                        </button>
                      </td>

                      {/* Source */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {contact.source || 'WhatsApp'}
                        </span>
                      </td>

                      {/* Opted In */}
                      <td className="py-3 px-3">
                        {contact.optInStatus ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400">
                            <XCircle className="w-3 h-3" />
                            No
                          </span>
                        )}
                      </td>

                      {/* Accounts (WhatsApp instance number) */}
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                        {instances[0]?.phone || instances[0]?.name || '—'}
                      </td>

                      {/* Assigned To */}
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {contact.assignedTo || '—'}
                      </td>

                      {/* Tags */}
                      <td className="py-3 px-3">
                        {parsedTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {parsedTags.map((t, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Dynamic Smart Columns values (e.g. 'test') */}
                      {customColumns.map((col) => {
                        const val = customMap[col.key] || customMap[col.name];
                        return (
                          <td key={col.id} className="py-3 px-3 text-slate-300 day:text-slate-700 text-xs font-mono">
                            {val !== undefined && val !== null && String(val) !== '' ? (
                              String(val)
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              if (onOpenWhatsAppChat) onOpenWhatsAppChat(contact.phone);
                              else window.open(`https://wa.me/${contact.phone}`, '_blank');
                            }}
                            className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 day:border-slate-200">
              <h2 className="text-base font-bold text-white day:text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0c57e4]" />
                <span>Add New Contact</span>
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Abhinandan Kumar"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 text-white day:text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                    WhatsApp Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="e.g. 919872345588"
                    className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 text-white day:text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                  Lead Source
                </label>
                <select
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 text-white day:text-slate-900"
                >
                  <option value="WhatsApp">WhatsApp Inbound</option>
                  <option value="API">API</option>
                  <option value="Manual">Manual</option>
                  <option value="Referral">Referral</option>
                  <option value="Web Form">Web Form</option>
                </select>
              </div>

              {/* Dynamic Custom Columns Inputs */}
              {customColumns.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800 day:border-slate-200">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Smart Columns Fields
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {customColumns.map((col) => (
                      <div key={col.id}>
                        <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                          {col.name}
                        </label>
                        <input
                          type={col.type === 'NUMBER' ? 'number' : col.type === 'DATE' ? 'date' : 'text'}
                          value={formCustomFields[col.key] || ''}
                          onChange={(e) =>
                            setFormCustomFields({
                              ...formCustomFields,
                              [col.key]: e.target.value,
                            })
                          }
                          placeholder={`Enter ${col.name}`}
                          className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2 text-white day:text-slate-900 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800 day:border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formPhone.trim()}
                  className="px-5 py-2 bg-[#0c57e4] hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-md shadow-blue-900/30"
                >
                  {submitting ? 'Saving...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Reminder Modal */}
      {showReminderModal && reminderContact && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 day:border-slate-200">
              <h2 className="text-base font-bold text-white day:text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Set Contact Reminder</span>
              </h2>
              <button
                onClick={() => setShowReminderModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleReminder} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                  Contact
                </label>
                <div className="p-2.5 rounded-xl bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 text-white day:text-slate-900 font-mono">
                  {reminderContact.name || reminderContact.phone} (+{reminderContact.phone})
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                  Reminder Title / Action *
                </label>
                <input
                  type="text"
                  required
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder="e.g. Follow up regarding proposal"
                  className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 text-white day:text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 day:text-slate-700 block mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-2.5 text-white day:text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800 day:border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0c57e4] text-white rounded-xl font-bold transition shadow-md shadow-blue-900/30"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import & Export Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 day:border-slate-200">
              <h2 className="text-base font-bold text-white day:text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400" />
                <span>Import & Export Guide</span>
              </h2>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 day:text-slate-700 leading-relaxed">
              <p>
                BulkFlow CRM supports <strong>CSV</strong> and <strong>Excel (.xlsx)</strong> imports with dynamic schema mapping.
              </p>
              <div className="p-3 rounded-xl bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-200 space-y-1 font-mono text-[11px]">
                <p className="text-emerald-400 font-bold">Standard Column Headers:</p>
                <p>• Phone (e.g. 919872345588 or +91 98723 45588)</p>
                <p>• Name (e.g. Rahul Sharma)</p>
                <p>• Tags (e.g. VIP; Inbound; Retail)</p>
                <p>• Smart Columns (e.g. test, Company, City, Budget)</p>
              </div>
              <p>
                When exporting, all visible Smart Columns will automatically be included in your downloaded CSV file.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800 day:border-slate-200">
              <a
                href="/api/contacts/sample?format=csv"
                download="sample_contacts.csv"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline font-semibold"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download Sample CSV Template</span>
              </a>
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
