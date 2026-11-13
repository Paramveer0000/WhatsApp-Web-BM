'use client';

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Copy,
  Check,
  RefreshCw,
  X,
  MessageSquare,
  Sparkles,
  Layers,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
  mediaUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QuickRepliesViewProps {
  onSelectReply?: (reply: QuickReply) => void;
  isPickerMode?: boolean;
}

export function QuickRepliesView({ onSelectReply, isPickerMode = false }: QuickRepliesViewProps) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & form state
  const [showModal, setShowModal] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form Fields
  const [formShortcut, setFormShortcut] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('Sales');
  const [formMediaUrl, setFormMediaUrl] = useState('');

  const fetchReplies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/quick-replies?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch quick replies');
      const data = await res.json();

      if (data.success) {
        setReplies(data.quickReplies || []);
        if (data.categories) setCategories(data.categories);
      }
    } catch (err: any) {
      toast.error('Failed to load quick replies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReplies();
  }, [selectedCategory, searchQuery]);

  const openCreateModal = () => {
    setEditingReply(null);
    setFormShortcut('/');
    setFormTitle('');
    setFormContent('');
    setFormCategory('Sales');
    setFormMediaUrl('');
    setShowModal(true);
  };

  const openEditModal = (reply: QuickReply) => {
    setEditingReply(reply);
    setFormShortcut(reply.shortcut);
    setFormTitle(reply.title);
    setFormContent(reply.content);
    setFormCategory(reply.category);
    setFormMediaUrl(reply.mediaUrl || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formShortcut.trim() || !formTitle.trim() || !formContent.trim()) {
      toast.error('Shortcut, title, and message content are required');
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        shortcut: formShortcut.trim(),
        title: formTitle.trim(),
        content: formContent.trim(),
        category: formCategory.trim() || 'General',
        mediaUrl: formMediaUrl.trim() || null,
      };

      if (editingReply) {
        payload.id = editingReply.id;
        const res = await fetch('/api/quick-replies', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update quick reply');
        toast.success('Quick reply updated!');
      } else {
        const res = await fetch('/api/quick-replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create quick reply');
        toast.success('Quick reply created!');
      }

      setShowModal(false);
      fetchReplies();
    } catch (err: any) {
      toast.error(err.message || 'Error saving quick reply');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quick reply?')) return;
    try {
      const res = await fetch(`/api/quick-replies?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete quick reply');
      toast.success('Quick reply deleted');
      fetchReplies();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting quick reply');
    }
  };

  const copyContent = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Quick reply text copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 dark:bg-slate-900/90 day:bg-white border border-slate-800 day:border-slate-200 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-950/40">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white day:text-slate-900 tracking-tight">
              Quick Replies & Canned Messages
            </h2>
            <p className="text-xs text-slate-400 day:text-slate-500">
              Instantly insert pre-saved responses, FAQs, and product links into live conversations
            </p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0c57e4] hover:bg-[#0944b5] text-white text-xs font-semibold shadow-lg shadow-blue-950/30 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Quick Reply</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/70 day:bg-white border border-slate-800 day:border-slate-200 p-3 rounded-xl">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
              selectedCategory === 'ALL'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-slate-400 day:text-slate-600 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100'
            }`}
          >
            All Categories ({replies.length})
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-slate-400 day:text-slate-600 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search /shortcut or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 day:bg-slate-50 border border-slate-700/80 day:border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white day:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Quick Replies Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
          <p className="text-xs">Loading quick replies...</p>
        </div>
      ) : replies.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center p-8 bg-slate-900/50 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 day:bg-slate-200 flex items-center justify-center text-slate-400 day:text-slate-500 mb-3">
            <Zap className="w-7 h-7 text-amber-400" />
          </div>
          <h3 className="text-sm font-semibold text-white day:text-slate-900">No quick replies found</h3>
          <p className="text-xs text-slate-400 day:text-slate-500 max-w-sm mt-1 mb-4">
            {searchQuery
              ? 'No quick replies matched your search keyword.'
              : 'Add canned responses like /pricing, /demo, or /support to speed up agent replies.'}
          </p>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quick Reply</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {replies.map((reply) => (
            <div
              key={reply.id}
              className="bg-slate-900/80 day:bg-white border border-slate-800 day:border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/50 transition-all shadow-sm group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    {reply.shortcut}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 day:bg-slate-100 text-slate-400 day:text-slate-600">
                    {reply.category}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-white day:text-slate-900 mb-1.5">
                  {reply.title}
                </h4>

                <p className="text-xs text-slate-400 day:text-slate-600 line-clamp-3 whitespace-pre-wrap bg-slate-950/50 day:bg-slate-50 p-2.5 rounded-lg border border-slate-800/80 day:border-slate-200 font-mono text-[11px]">
                  {reply.content}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800/80 day:border-slate-100">
                {isPickerMode ? (
                  <button
                    onClick={() => onSelectReply && onSelectReply(reply)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Insert Reply</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => copyContent(reply.content, reply.id)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white day:hover:text-slate-900 transition"
                    >
                      {copiedId === reply.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === reply.id ? 'Copied' : 'Copy'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(reply)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100 transition"
                        title="Edit quick reply"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(reply.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 day:hover:bg-slate-100 transition"
                        title="Delete quick reply"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Reply Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 day:border-slate-200">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-white day:text-slate-900">
                  {editingReply ? 'Edit Quick Reply' : 'Create Quick Reply'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white day:hover:text-slate-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                    Shortcut <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="/pricing"
                    value={formShortcut}
                    onChange={(e) => setFormShortcut(e.target.value)}
                    className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-amber-400 day:text-amber-600 focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Type this shortcut in inbox to auto-fill
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="Sales, Support, FAQ..."
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                  Title / Label <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Pricing Plans"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 day:text-slate-700 mb-1">
                  Message Content <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Type the message body that will be sent..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full bg-slate-800 day:bg-slate-50 border border-slate-700 day:border-slate-300 rounded-xl px-3.5 py-2 text-xs text-white day:text-slate-900 focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800 day:border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white day:hover:text-slate-800 hover:bg-slate-800 day:hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[#0c57e4] hover:bg-[#0944b5] text-white text-xs font-semibold shadow transition cursor-pointer"
                >
                  {saving ? 'Saving...' : editingReply ? 'Update Reply' : 'Create Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

