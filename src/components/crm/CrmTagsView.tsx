'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag as TagIcon,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Lightbulb,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface CrmTagItem {
  id: string;
  name: string;
  color: string;
  contactCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

const PRESET_COLORS = [
  '#0c57e4', // Royal Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ef4444', // Red / Rose
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#64748b', // Slate
];

interface CrmTagsViewProps {
  onSelectTagForFilter?: (tagName: string) => void;
}

export function CrmTagsView({ onSelectTagForFilter }: CrmTagsViewProps) {
  const [tags, setTags] = useState<CrmTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Form State
  const [tagNameInput, setTagNameInput] = useState('');
  const [selectedColor, setSelectedColor] = useState('#0c57e4');
  const [submitting, setSubmitting] = useState(false);

  const fetchTags = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const res = await fetch('/api/crm/tags');
      const data = await res.json();
      if (data.success && Array.isArray(data.tags)) {
        setTags(data.tags);
      }
    } catch {
      toast.error('Failed to load CRM tags');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = tagNameInput.trim();
    if (!name) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: selectedColor }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create tag');
      }

      toast.success(`Tag "${name}" created successfully!`, 'Tag Added');
      setTagNameInput('');
      fetchTags();
    } catch (err: any) {
      toast.error(err.message, 'Tag Creation Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTag = async (tag: CrmTagItem) => {
    if (!confirm(`Are you sure you want to delete tag "${tag.name}"? Contacts with this tag will not be deleted.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/crm/tags?id=${tag.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete tag');
      }

      toast.success(`Tag "${tag.name}" deleted`, 'Tag Removed');
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch (err: any) {
      toast.error(err.message, 'Delete Failed');
    }
  };

  const filteredTags = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, filterQuery]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header matching Zolo Suit Manage Tags */}
      <div>
        <div className="text-[11px] font-medium text-slate-400 day:text-slate-500 mb-1 flex items-center gap-1.5">
          <span>Dashboard</span>
          <span>&gt;</span>
          <span>Manage</span>
          <span>&gt;</span>
          <span className="text-white day:text-slate-900 font-semibold">Tags</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0c57e4] flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
              <TagIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white day:text-slate-900 flex items-center gap-2">
                CRM Tags
              </h1>
              <p className="text-xs text-slate-400 day:text-slate-600">
                Organize and segment your contacts with custom tags
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              LIVE CRM DATABASE
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout (Matching Zolo Suit Tags Screen) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Card: Add Tag Form */}
        <div className="lg:col-span-4 bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-6 shadow-xl space-y-5">
          <form onSubmit={handleAddTag} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 day:text-slate-700 uppercase tracking-wider block mb-2">
                Tag Name
              </label>
              <input
                type="text"
                value={tagNameInput}
                onChange={(e) => setTagNameInput(e.target.value)}
                placeholder="e.g. VIP Customer"
                className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-white day:text-slate-900 focus:outline-none focus:border-[#0c57e4] transition"
                required
              />
            </div>

            {/* Color Swatch Picker */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 day:text-slate-600 block mb-2">
                Badge Color Accent
              </label>
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      selectedColor === c ? 'scale-125 ring-2 ring-white day:ring-slate-900 shadow-md' : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !tagNameInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0c57e4] hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-900/30 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Adding Tag...' : '+ Add New Tag'}</span>
            </button>
          </form>

          {/* Quick Tip Box (Matching Zolo Suit) */}
          <div className="p-3.5 rounded-xl bg-blue-500/5 day:bg-blue-50 border border-blue-500/15 day:border-blue-200 text-xs text-slate-300 day:text-slate-700 flex items-start gap-2.5 leading-relaxed">
            <Lightbulb className="w-4 h-4 text-[#0c57e4] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[11px] text-blue-400 day:text-blue-700 uppercase tracking-wider mb-0.5">
                Quick Tip
              </p>
              <p className="text-[11px] text-slate-400 day:text-slate-600">
                Tags help you create targeted broadcast campaigns and filtered views.
              </p>
            </div>
          </div>
        </div>

        {/* Right Card: Tags Table & Filter (Matching Zolo Suit) */}
        <div className="lg:col-span-8 bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Filter */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter existing tags..."
                className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-[#0c57e4] transition"
              />
            </div>

            {/* Counter & Refresh */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400 day:text-slate-600">
                {filteredTags.length} records found
              </span>
              <button
                onClick={() => fetchTags(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 day:bg-slate-100 day:hover:bg-slate-200 text-slate-300 day:text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-800 day:border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 day:bg-slate-100 text-slate-400 day:text-slate-600 font-semibold border-b border-slate-800 day:border-slate-200">
                <tr>
                  <th className="py-3 px-4 flex items-center gap-1.5">
                    <TagIcon className="w-3 h-3 text-slate-400" />
                    <span>Tag Name</span>
                  </th>
                  <th className="py-3 px-4">Linked Contacts</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 day:divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500">
                      Loading tags...
                    </td>
                  </tr>
                ) : filteredTags.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500">
                      {filterQuery ? 'No tags match your search.' : 'No tags created yet. Use the form on the left to add your first tag.'}
                    </td>
                  </tr>
                ) : (
                  filteredTags.map((tag) => (
                    <tr
                      key={tag.id}
                      className="hover:bg-slate-850/50 day:hover:bg-slate-50 transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: tag.color || '#0c57e4' }}
                          />
                          <span className="font-semibold text-white day:text-slate-900">
                            {tag.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 day:bg-slate-100 text-slate-300 day:text-slate-700">
                          <Users className="w-3 h-3 text-slate-400" />
                          {tag.contactCount || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition cursor-pointer"
                          title="Delete Tag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
