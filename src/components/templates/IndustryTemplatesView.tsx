'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Copy,
  Check,
  Send,
  Edit2,
  Trash2,
  Layers,
  ShoppingBag,
  Building2,
  HeartPulse,
  GraduationCap,
  Briefcase,
  CircleDollarSign,
  Car,
  UtensilsCrossed,
  Dumbbell,
  Plane,
  X,
  Plus,
} from 'lucide-react';
import {
  INDUSTRY_CATEGORIES,
  INDUSTRY_TEMPLATES,
  IndustryTemplate,
  IndustryCategory,
} from '@/lib/industry-templates';
import { EditTemplateModal, TemplateData } from '@/components/EditTemplateModal';
import { CreateTemplateModal } from '@/components/CreateTemplateModal';
import { toast } from '@/lib/toast';

interface IndustryTemplatesViewProps {
  savedTemplates: any[];
  onReloadSavedTemplates: () => void;
  onUseInCampaign: (content: string, mediaType?: string, templateTitle?: string) => void;
}

export function IndustryTemplatesView({
  savedTemplates,
  onReloadSavedTemplates,
  onUseInCampaign,
}: IndustryTemplatesViewProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Icon mapping
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShoppingBag':
        return <ShoppingBag className="w-4 h-4" />;
      case 'Building2':
        return <Building2 className="w-4 h-4" />;
      case 'HeartPulse':
        return <HeartPulse className="w-4 h-4" />;
      case 'GraduationCap':
        return <GraduationCap className="w-4 h-4" />;
      case 'Briefcase':
        return <Briefcase className="w-4 h-4" />;
      case 'CircleDollarSign':
        return <CircleDollarSign className="w-4 h-4" />;
      case 'Car':
        return <Car className="w-4 h-4" />;
      case 'UtensilsCrossed':
        return <UtensilsCrossed className="w-4 h-4" />;
      case 'Dumbbell':
        return <Dumbbell className="w-4 h-4" />;
      case 'Plane':
        return <Plane className="w-4 h-4" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <Layers className="w-4 h-4" />;
    }
  };

  // Convert custom saved templates to normalized shape
  const formattedSavedTemplates: IndustryTemplate[] = useMemo(() => {
    return savedTemplates.map((t) => {
      let cat = 'Custom';
      if (t.tags) {
        try {
          const parsed = JSON.parse(t.tags);
          if (Array.isArray(parsed) && parsed[0]) cat = parsed[0];
        } catch {}
      }
      return {
        id: t.id,
        industryId: 'custom',
        title: t.name,
        category: cat,
        content: t.content,
        mediaType: (t.mediaType as any) || 'text',
        recommendedVariables: ['name'],
        usageCount: 1,
      };
    });
  }, [savedTemplates]);

  // Combined list
  const allTemplates = useMemo(() => {
    return [...formattedSavedTemplates, ...INDUSTRY_TEMPLATES];
  }, [formattedSavedTemplates]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((t) => {
      const matchesIndustry =
        selectedIndustry === 'all' ||
        (selectedIndustry === 'custom' && t.industryId === 'custom') ||
        t.industryId === selectedIndustry;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q);

      return matchesIndustry && matchesSearch;
    });
  }, [allTemplates, selectedIndustry, searchQuery]);

  const handleCopyText = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success('Message copy copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenEdit = (t: IndustryTemplate) => {
    setEditingTemplate({
      id: t.id,
      title: t.title,
      content: t.content,
      category: t.category,
      mediaType: t.mediaType,
    });
    setShowEditModal(true);
  };

  const handleDeleteCustom = async (id: string, name: string) => {
    if (!confirm(`Delete custom template "${name}"?`)) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      toast.success('Template deleted');
      onReloadSavedTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Error deleting template');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 day:bg-white border border-slate-800 day:border-slate-200 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0c57e4] to-blue-700 flex items-center justify-center text-white shadow-md shadow-blue-950/40">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white day:text-slate-900 tracking-tight">
              Industry Message Templates
            </h2>
            <p className="text-xs text-slate-400 day:text-slate-500">
              Browse proven, high-converting WhatsApp campaign copy organized by industry vertical
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0c57e4] hover:bg-[#0944b5] text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-900/30 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Custom Template</span>
        </button>
      </div>

      {/* Industry Category Selector Bar (Pills) */}
      <div className="bg-slate-900/80 day:bg-white border border-slate-800 day:border-slate-200 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar">
          {INDUSTRY_CATEGORIES.map((cat) => {
            const isActive = selectedIndustry === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedIndustry(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#0c57e4] text-white font-semibold shadow-md shadow-blue-900/30'
                    : 'text-slate-400 day:text-slate-600 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100'
                }`}
                title={cat.description}
              >
                {getCategoryIcon(cat.iconName)}
                <span>{cat.name}</span>
              </button>
            );
          })}

          {/* My Saved Templates Filter Tab */}
          <button
            onClick={() => setSelectedIndustry('custom')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer shrink-0 ${
              selectedIndustry === 'custom'
                ? 'bg-[#0c57e4] text-white font-semibold shadow-md shadow-blue-900/30'
                : 'text-slate-400 day:text-slate-600 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>My Custom ({savedTemplates.length})</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Active Count */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 day:bg-slate-50 border border-slate-800 day:border-slate-200 p-3 rounded-xl">
        <div className="text-xs text-slate-400 day:text-slate-600 font-medium">
          Showing <span className="font-bold text-white day:text-slate-900">{filteredTemplates.length}</span> templates in{' '}
          <span className="text-[#0c57e4] font-semibold">
            {selectedIndustry === 'all'
              ? 'All Industries'
              : selectedIndustry === 'custom'
              ? 'My Custom Templates'
              : INDUSTRY_CATEGORIES.find((c) => c.id === selectedIndustry)?.name}
          </span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search templates or merge tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 day:bg-white border border-slate-700 day:border-slate-300 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white day:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[#0c57e4]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Templates Card Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center p-8 bg-slate-900/50 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl">
          <Sparkles className="w-12 h-12 text-slate-500 mb-3" />
          <h3 className="text-sm font-bold text-white day:text-slate-900">No templates found</h3>
          <p className="text-xs text-slate-400 day:text-slate-500 max-w-sm mt-1 mb-4">
            No templates matched your search in this industry category. Try selecting another industry or create a new template.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0c57e4] text-white rounded-xl text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((tmpl) => {
            const isCustom = tmpl.industryId === 'custom';

            return (
              <div
                key={tmpl.id}
                className="bg-slate-900/90 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-[#0c57e4]/50 transition-all group"
              >
                <div>
                  {/* Category Pill and Actions */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isCustom
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-blue-500/10 text-[#0c57e4] day:text-blue-600 border border-blue-500/20'
                      }`}
                    >
                      {tmpl.category} {isCustom ? '(Saved)' : ''}
                    </span>

                    <div className="flex items-center gap-1">
                      {isCustom && (
                        <button
                          onClick={() => handleDeleteCustom(tmpl.id, tmpl.title)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 day:hover:bg-slate-100 transition"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCopyText(tmpl.content, tmpl.id)}
                        className="p-1 rounded text-slate-400 hover:text-white day:hover:text-slate-800 hover:bg-slate-800 day:hover:bg-slate-100 transition"
                        title="Copy text"
                      >
                        {copiedId === tmpl.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-white day:text-slate-900 group-hover:text-[#0c57e4] transition-colors">
                    {tmpl.title}
                  </h3>

                  {/* WhatsApp Content Bubble */}
                  <div className="bg-[#0b141a] day:bg-[#f8fafc] p-3.5 rounded-xl border border-slate-800 day:border-slate-200 text-xs text-slate-300 day:text-slate-700 font-mono mt-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {tmpl.content}
                  </div>
                </div>

                {/* 2 Action Buttons (Edit & Campaign) */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 day:border-slate-100">
                  {/* Edit Button */}
                  <button
                    onClick={() => handleOpenEdit(tmpl)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 day:bg-slate-100 hover:bg-slate-700 day:hover:bg-slate-200 text-white day:text-slate-800 text-xs font-semibold transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit Copy</span>
                  </button>

                  {/* Use in Campaign Button */}
                  <button
                    onClick={() => onUseInCampaign(tmpl.content, tmpl.mediaType, tmpl.title)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#0c57e4] hover:bg-[#0944b5] text-white text-xs font-bold shadow-md shadow-blue-900/30 transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Use in Campaign</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit & Customize Modal */}
      <EditTemplateModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialTemplate={editingTemplate}
        onTemplateSaved={() => {
          onReloadSavedTemplates();
        }}
        onUseInCampaign={(customized) => {
          onUseInCampaign(customized.content, customized.mediaType, customized.title);
        }}
      />

      {/* Create Template Modal */}
      <CreateTemplateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTemplateSaved={() => {
          onReloadSavedTemplates();
        }}
      />
    </div>
  );
}

