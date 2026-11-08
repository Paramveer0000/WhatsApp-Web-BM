'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Layers,
  HelpCircle,
  Clock,
  UserCheck,
  Send,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { PREBUILT_TEMPLATES, PrebuiltTemplate } from '@/lib/flow/templates';

interface TemplateGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateKey: string | null) => void;
}

export function TemplateGalleryModal({
  isOpen,
  onClose,
  onSelectTemplate,
}: TemplateGalleryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Templates' },
    { id: 'lead_gen', label: 'Lead Capture' },
    { id: 'support', label: 'Customer Support' },
    { id: 'sales', label: 'Sales & Appointments' },
    { id: 'utility', label: 'Business Hours & Utilities' },
  ];

  const filteredTemplates =
    selectedCategory === 'all'
      ? PREBUILT_TEMPLATES
      : PREBUILT_TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold text-white">Chatbot Template Gallery</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Pick a ready-to-use plug-and-play template, customize your messages, and launch in minutes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/30 flex items-center gap-2 overflow-x-auto text-xs">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer whitespace-nowrap ${
                selectedCategory === c.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Option 0: Start from Scratch */}
          <div
            onClick={() => onSelectTemplate(null)}
            className="group p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 transition cursor-pointer flex flex-col justify-between hover:shadow-xl hover:shadow-emerald-950/20"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-emerald-500/40 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 mb-3 transition">
                <Plus className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm group-hover:text-emerald-400 transition">
                Start from Scratch (Blank)
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Build your visual chatbot flow from a blank canvas by dragging and connecting custom nodes.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-emerald-400">
              <span>Custom Canvas</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Prebuilt Templates */}
          {filteredTemplates.map((t) => (
            <div
              key={t.key}
              onClick={() => onSelectTemplate(t.key)}
              className="group p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 transition cursor-pointer flex flex-col justify-between hover:shadow-xl hover:shadow-emerald-950/20"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold">
                    {t.flow.nodes.length} Nodes
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm group-hover:text-emerald-400 transition">
                  {t.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-3">
                  {t.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-xs font-semibold text-emerald-400">
                <span>Use Template</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
