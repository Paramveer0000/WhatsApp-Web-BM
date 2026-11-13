'use client';

import React, { useState, useEffect } from 'react';
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
  Send,
  Save,
  Copy,
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface TemplateData {
  id?: string;
  title: string;
  content: string;
  category?: string;
  mediaType?: 'text' | 'image' | 'video' | 'document';
}

interface EditTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTemplate: TemplateData | null;
  onTemplateSaved?: () => void;
  onUseInCampaign?: (template: TemplateData) => void;
}

export function EditTemplateModal({
  isOpen,
  onClose,
  initialTemplate,
  onTemplateSaved,
  onUseInCampaign,
}: EditTemplateModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Marketing');
  const [content, setContent] = useState('');
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video' | 'document'>('text');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialTemplate) {
      setTitle(initialTemplate.title || '');
      setContent(initialTemplate.content || '');
      setCategory(initialTemplate.category || 'General');
      setMediaType(initialTemplate.mediaType || 'text');
    }
  }, [initialTemplate]);

  if (!isOpen || !initialTemplate) return null;

  const insertSnippet = (snippet: string) => {
    setContent((prev) => prev + snippet);
  };

  const handleSaveToDatabase = async () => {
    if (!title.trim() || !content.trim()) {
      setErrorMsg('Template title and content are required.');
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
          mediaType,
          tags: [category, 'custom'],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save template');

      toast.success(`Template "${title}" saved successfully!`);
      if (onTemplateSaved) onTemplateSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving template');
      toast.error(err.message || 'Error saving template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLaunchCampaign = () => {
    if (!content.trim()) {
      setErrorMsg('Message content is required.');
      return;
    }

    if (onUseInCampaign) {
      onUseInCampaign({
        title,
        content,
        category,
        mediaType,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-950 day:bg-slate-50 px-6 py-4 border-b border-slate-800 day:border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#0c57e4]/10 border border-[#0c57e4]/20 text-[#0c57e4]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white day:text-slate-900 tracking-tight">
                Customize & Launch Template
              </h3>
              <p className="text-xs text-slate-400 day:text-slate-500">
                Edit copy, dynamic variables, and launch directly into campaign wizard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white day:hover:text-slate-800 hover:bg-slate-800 day:hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 font-sans text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Title */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200 day:text-slate-700">
                Template Name <span className="text-[#0c57e4]">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Special Festive Discount Offer"
                className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl px-3.5 py-2 text-white day:text-slate-900 text-xs focus:outline-none focus:border-[#0c57e4] transition"
              />
            </div>

            {/* Category / Industry */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200 day:text-slate-700">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl px-3.5 py-2 text-white day:text-slate-900 text-xs focus:outline-none focus:border-[#0c57e4] transition"
              />
            </div>
          </div>

          {/* Quick Merge Tag Chips */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-400 day:text-slate-500">
              Quick Merge Tags & Spintax Variations (Click to insert):
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: '+ {{name}}', code: '{{name}}', color: 'text-emerald-400' },
                { label: '+ {{name|Friend}}', code: '{{name|Friend}}', color: 'text-emerald-400' },
                { label: '+ {{company}}', code: '{{company}}', color: 'text-sky-400' },
                { label: '+ {{city}}', code: '{{city}}', color: 'text-sky-400' },
                { label: '+ {Hi|Hello|Dear}', code: '{Hi|Hello|Dear}', color: 'text-amber-400' },
                { label: '*bold*', code: '*bold text*', color: 'text-slate-300' },
                { label: '_italic_', code: '_italic text_', color: 'text-slate-300' },
                { label: '`code`', code: '`code`', color: 'text-slate-300' },
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => insertSnippet(chip.code)}
                  className={`px-2.5 py-1 rounded-lg bg-slate-800 day:bg-slate-100 hover:bg-slate-700 day:hover:bg-slate-200 ${chip.color} font-mono text-[10px] transition border border-slate-700/60 day:border-slate-300`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-200 day:text-slate-700">
                Message Body <span className="text-[#0c57e4]">*</span>
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                {content.length} characters
              </span>
            </div>
            <textarea
              required
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your WhatsApp message copy here..."
              className="w-full bg-slate-950 day:bg-slate-50 border border-slate-800 day:border-slate-300 rounded-xl p-3.5 text-white day:text-slate-900 font-mono text-xs focus:outline-none focus:border-[#0c57e4] transition leading-relaxed"
            />
          </div>

          {/* WhatsApp Preview Bubble */}
          {content.trim() && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80 day:border-slate-200">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 day:text-slate-500">
                WhatsApp Live Preview:
              </span>
              <div className="bg-[#0b141a] day:bg-[#efeae2] p-4 rounded-2xl border border-slate-800 day:border-slate-300 flex justify-end">
                <div className="bg-[#005c4b] day:bg-[#d9fdd3] text-white day:text-slate-900 rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[85%] text-xs shadow-md whitespace-pre-wrap leading-relaxed font-sans">
                  {content.replace(/\{([^}]+)\}/g, (match, choices) => {
                    if (choices.includes('|')) {
                      return choices.split('|')[0];
                    }
                    return match;
                  })}
                  <span className="text-[9px] text-emerald-200 day:text-slate-500 block text-right mt-1 font-mono">
                    12:00 PM ✓✓
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 day:bg-slate-50 border-t border-slate-800 day:border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white day:hover:text-slate-800 hover:bg-slate-800 day:hover:bg-slate-200 transition order-2 sm:order-1"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            {/* Save as Custom Template */}
            <button
              type="button"
              onClick={handleSaveToDatabase}
              disabled={isSaving}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 day:bg-slate-200 hover:bg-slate-700 day:hover:bg-slate-300 text-white day:text-slate-800 text-xs font-semibold transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Template'}</span>
            </button>

            {/* Launch in Campaign */}
            <button
              type="button"
              onClick={handleLaunchCampaign}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#0c57e4] hover:bg-[#0944b5] text-white text-xs font-bold shadow-lg shadow-blue-900/30 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Use in Campaign →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

