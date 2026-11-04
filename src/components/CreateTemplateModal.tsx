'use client';

import React, { useState } from 'react';
import {
  FileText,
  X,
  Sparkles,
  Check,
  AlertCircle,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Tag,
} from 'lucide-react';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateSaved: () => void;
}

export function CreateTemplateModal({
  isOpen,
  onClose,
  onTemplateSaved,
}: CreateTemplateModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Marketing');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const insertSnippet = (snippet: string) => {
    setContent((prev) => prev + snippet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Template name is required.');
      return;
    }
    if (!content.trim()) {
      setErrorMsg('Template message content is required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title.trim(),
          content: content.trim(),
          tags: [category, 'custom'],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save template');

      onTemplateSaved();
      onClose();
      setTitle('');
      setContent('');
      setCategory('Marketing');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving template');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Create Custom Template</h3>
              <p className="text-xs text-slate-400">Design reusable message copy with spintax & variable tags</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 font-sans text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Title */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200">
                Template Title / Name <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Special Festive Discount Offer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="Marketing">Marketing</option>
                <option value="Transactional">Transactional</option>
                <option value="Reminder">Reminder</option>
                <option value="Support">Support</option>
                <option value="Onboarding">Onboarding</option>
                <option value="Retention">Retention</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
          </div>

          {/* Quick Helper Chips */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400">
              Quick Formatting & Dynamic Variable Chips (click to insert):
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => insertSnippet('{{name}}')}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono text-[10px] transition border border-slate-700/60"
              >
                + {'{{name}}'}
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('{{name|Friend}}')}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono text-[10px] transition border border-slate-700/60"
              >
                + {'{{name|Friend}}'}
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('{{company}}')}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-400 font-mono text-[10px] transition border border-slate-700/60"
              >
                + {'{{company}}'}
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('{{city}}')}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sky-400 font-mono text-[10px] transition border border-slate-700/60"
              >
                + {'{{city}}'}
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('{Hi|Hello|Dear}')}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-400 font-mono text-[10px] transition border border-slate-700/60"
              >
                + {'{Hi|Hello|Dear}'} (Spintax)
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('*bold text*')}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] transition border border-slate-700/60 flex items-center gap-1"
              >
                <Bold className="w-2.5 h-2.5" />
                <span>*bold*</span>
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('_italic text_')}
                className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] transition border border-slate-700/60 flex items-center gap-1"
              >
                <Italic className="w-2.5 h-2.5" />
                <span>_italic_</span>
              </button>
            </div>
          </div>

          {/* Message Content Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-200">
                Message Copy <span className="text-emerald-400">*</span>
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                {content.length} characters
              </span>
            </div>
            <textarea
              required
              rows={6}
              placeholder="Type your WhatsApp message copy here... Use {Hi|Hello} for random greetings and {{name}} for customer names."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 transition leading-relaxed"
            />
          </div>

          {/* WhatsApp Preview Bubble */}
          {content.trim() && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                WhatsApp Preview (Approximate):
              </span>
              <div className="bg-[#0b141a] p-3 rounded-2xl border border-slate-800 flex justify-end">
                <div className="bg-[#005c4b] text-white rounded-2xl rounded-tr-none px-3.5 py-2 max-w-[85%] text-xs shadow-md whitespace-pre-wrap leading-relaxed font-sans">
                  {content.replace(/\{([^}]+)\}/g, (match, choices) => {
                    if (choices.includes('|')) {
                      return choices.split('|')[0];
                    }
                    return match;
                  })}
                  <span className="text-[9px] text-emerald-200 block text-right mt-1 font-mono">
                    12:00 PM ✓✓
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Template</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
