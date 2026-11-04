'use client';

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Shuffle,
  Sliders,
  Image as ImageIcon,
  Video,
  FileText,
  Smartphone,
  Eye,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  DistributionMode,
  RotationScope,
  VariantInput,
  detectDuplicateVariants,
  calculateJaccardSimilarity,
} from '@/lib/rotation';
import { countSpintaxVariations } from '@/lib/spintax';

interface MultiMessageRotationEditorProps {
  distributionMode: DistributionMode;
  onDistributionModeChange: (mode: DistributionMode) => void;
  rotationScope: RotationScope;
  onRotationScopeChange: (scope: RotationScope) => void;
  shuffleAudience: boolean;
  onShuffleAudienceChange: (shuffle: boolean) => void;
  shuffleSeed?: number;
  onShuffleSeedChange: (seed: number) => void;
  avoidRepeatContent: boolean;
  onAvoidRepeatContentChange: (avoid: boolean) => void;
  variants: VariantInput[];
  onVariantsChange: (variants: VariantInput[]) => void;
  singleTemplate: string;
  onSingleTemplateChange: (template: string) => void;
  singleMediaType: string;
  onSingleMediaTypeChange: (mediaType: string) => void;
  singleMediaUrl: string;
  onSingleMediaUrlChange: (url: string) => void;
  singleFileName: string;
  onSingleFileNameChange: (name: string) => void;
  activePreviewVariantIndex: number;
  onActivePreviewVariantIndexChange: (index: number) => void;
  totalRecipientsCount?: number;
}

export default function MultiMessageRotationEditor({
  distributionMode,
  onDistributionModeChange,
  rotationScope,
  onRotationScopeChange,
  shuffleAudience,
  onShuffleAudienceChange,
  shuffleSeed = 42,
  onShuffleSeedChange,
  avoidRepeatContent,
  onAvoidRepeatContentChange,
  variants,
  onVariantsChange,
  singleTemplate,
  onSingleTemplateChange,
  singleMediaType,
  onSingleMediaTypeChange,
  singleMediaUrl,
  onSingleMediaUrlChange,
  singleFileName,
  onSingleFileNameChange,
  activePreviewVariantIndex,
  onActivePreviewVariantIndexChange,
  totalRecipientsCount = 500,
}: MultiMessageRotationEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewRecipientNumber, setPreviewRecipientNumber] = useState(1);
  const [editingCardIndex, setEditingCardIndex] = useState(0);

  // Auto-sync singleTemplate to/from variants when switching modes
  const handleModeChange = (newMode: DistributionMode) => {
    onDistributionModeChange(newMode);
    if (newMode !== 'SINGLE' && variants.length === 0) {
      // Initialize with 4 balanced variants
      onVariantsChange([
        {
          position: 1,
          label: 'Message 1 (Friendly)',
          content: singleTemplate || '{Hi|Hello|Dear} {name|Friend}! We are excited to announce our seasonal promotions. Use code `SAVE20` for 20% off!',
          mediaType: singleMediaType || 'text',
          mediaUrl: singleMediaUrl || '',
          fileName: singleFileName || '',
          weight: 25,
        },
        {
          position: 2,
          label: 'Message 2 (Direct)',
          content: 'Hello {name|there}: Enjoy 20% savings on all catalogue services this week using code `SAVE20`. Reply here if you need any assistance!',
          mediaType: 'text',
          mediaUrl: '',
          fileName: '',
          weight: 25,
        },
        {
          position: 3,
          label: 'Message 3 (Urgent)',
          content: 'Reminder {name|Customer}: Limited-time exclusive discount available for your team. Apply voucher `SAVE20` before Sunday midnight!',
          mediaType: 'text',
          mediaUrl: '',
          fileName: '',
          weight: 25,
        },
        {
          position: 4,
          label: 'Message 4 (Value)',
          content: 'Greetings {name|Partner}! Check out what is new with our product updates today. Redeem your 20% voucher `SAVE20` anytime this week.',
          mediaType: 'text',
          mediaUrl: '',
          fileName: '',
          weight: 25,
        },
      ]);
    }
  };

  // Add new message card (up to 8)
  const handleAddVariant = () => {
    if (variants.length >= 8) return;
    const newPos = variants.length + 1;
    const equalWeight = Math.floor(100 / (variants.length + 1));
    const updated = [
      ...variants.map((v) => ({ ...v, weight: equalWeight })),
      {
        position: newPos,
        label: `Message ${newPos}`,
        content: `Hi {name|there}! Quick update regarding your account benefits. Code: \`SAVE20\`.`,
        mediaType: 'text',
        mediaUrl: '',
        fileName: '',
        weight: equalWeight,
      },
    ];
    // Adjust remainder on first
    const sum = updated.reduce((a, b) => a + (b.weight || 0), 0);
    if (sum < 100) updated[0]!.weight = (updated[0]!.weight || 0) + (100 - sum);

    onVariantsChange(updated);
    setEditingCardIndex(updated.length - 1);
    onActivePreviewVariantIndexChange(updated.length - 1);
  };

  // Remove variant
  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 2) {
      alert('Multi-message campaigns require at least 2 message variants.');
      return;
    }
    const filtered = variants.filter((_, i) => i !== index).map((v, i) => ({
      ...v,
      position: i + 1,
      label: v.label.startsWith('Message ') ? `Message ${i + 1}` : v.label,
    }));
    onVariantsChange(filtered);
    const newIdx = Math.max(0, Math.min(editingCardIndex, filtered.length - 1));
    setEditingCardIndex(newIdx);
    onActivePreviewVariantIndexChange(newIdx);
  };

  // Duplicate variant
  const handleDuplicateVariant = (index: number) => {
    if (variants.length >= 8) {
      alert('Maximum 8 message variants allowed.');
      return;
    }
    const source = variants[index]!;
    const newVariants = [...variants];
    newVariants.splice(index + 1, 0, {
      ...source,
      label: `${source.label} (Copy)`,
      position: index + 2,
    });
    const reordered = newVariants.map((v, i) => ({ ...v, position: i + 1 }));
    onVariantsChange(reordered);
    setEditingCardIndex(index + 1);
    onActivePreviewVariantIndexChange(index + 1);
  };

  // Move Up / Down
  const handleMoveVariant = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= variants.length) return;
    const reordered = [...variants];
    const temp = reordered[index]!;
    reordered[index] = reordered[target]!;
    reordered[target] = temp;
    const updated = reordered.map((v, i) => ({ ...v, position: i + 1 }));
    onVariantsChange(updated);
    setEditingCardIndex(target);
    onActivePreviewVariantIndexChange(target);
  };

  // Update card content
  const handleUpdateCard = (index: number, patch: Partial<VariantInput>) => {
    const updated = variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onVariantsChange(updated);
  };

  // Intelligent Variations Generator Helper
  const handleGenerateVariations = () => {
    const baseContent = variants[0]?.content || singleTemplate || 'Special discount offer for your team';
    const variationsTemplates = [
      {
        label: 'Message 1 (Friendly)',
        content: `{Hi|Hello|Hey} {name|Friend}! Exciting news: we have an exclusive *20% discount* waiting for you today. Use code \`SAVE20\` at checkout!`,
      },
      {
        label: 'Message 2 (Direct & Short)',
        content: `Hello {name|there}: Enjoy 20% off all orders this week with code \`SAVE20\`. Valid till Sunday!`,
      },
      {
        label: 'Message 3 (Value & Feature)',
        content: `Greetings {name|Partner}! Discover what is new in our latest release. Take advantage of a special 20% savings with voucher \`SAVE20\`.`,
      },
      {
        label: 'Message 4 (Urgent Exclusive)',
        content: `Reminder {name|Customer}: Your private 20% discount voucher \`SAVE20\` expires soon. Don’t miss out!`,
      },
    ];

    const updated = variationsTemplates.map((item, idx) => ({
      position: idx + 1,
      label: item.label,
      content: item.content,
      mediaType: 'text',
      mediaUrl: '',
      fileName: '',
      weight: 25,
    }));

    onVariantsChange(updated);
    alert('Generated 4 distinct tone variants (Friendly, Direct, Value, Urgent) with diverse vocabulary!');
  };

  // Detect duplicate pairs
  const duplicateAlerts = React.useMemo(() => {
    if (distributionMode === 'SINGLE' || variants.length < 2) return [];
    return detectDuplicateVariants(variants, 0.85);
  }, [variants, distributionMode]);

  // Rotation colors per message
  const badgeColors = [
    { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', bar: 'bg-emerald-500' },
    { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/40', bar: 'bg-sky-500' },
    { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40', bar: 'bg-purple-500' },
    { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40', bar: 'bg-amber-500' },
    { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40', bar: 'bg-rose-500' },
    { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/40', bar: 'bg-indigo-500' },
    { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/40', bar: 'bg-teal-500' },
    { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40', bar: 'bg-cyan-500' },
  ];

  // Calculate projected recipient assignments for the preview strip (first 12)
  const previewStrip = Array.from({ length: 12 }, (_, i) => {
    let variantPos = 1;
    if (distributionMode === 'SINGLE' || variants.length === 0) {
      variantPos = 1;
    } else if (distributionMode === 'ROTATE') {
      variantPos = (i % variants.length) + 1;
    } else if (distributionMode === 'RANDOM') {
      variantPos = ((i * 7 + 3) % variants.length) + 1;
    } else if (distributionMode === 'WEIGHTED') {
      variantPos = (i % variants.length) + 1;
    }
    const color = badgeColors[(variantPos - 1) % badgeColors.length]!;
    return {
      recipientIdx: i + 1,
      variantPos,
      label: `M${variantPos}`,
      color,
    };
  });

  // Calculate message for "Show as recipient #N"
  const getRecipientVariantIndex = (recNum: number) => {
    if (distributionMode === 'SINGLE' || variants.length === 0) return 0;
    const n = Math.max(1, recNum);
    return (n - 1) % variants.length;
  };

  return (
    <div className="space-y-4">
      {/* ========================================================= */}
      {/* 1. DISTRIBUTION MODES SELECTOR (Section 1)               */}
      {/* ========================================================= */}
      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Campaign Message Distribution Mode</span>
          </label>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Anti-Ban Safety Multiplier
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {/* Mode 1: Single */}
          <button
            type="button"
            onClick={() => handleModeChange('SINGLE')}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              distributionMode === 'SINGLE'
                ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <div>
              <p className="font-bold text-slate-100 flex items-center justify-between">
                <span>1. Single Message</span>
                {distributionMode === 'SINGLE' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">One template broadcasted to all audience contacts.</p>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">Standard mode</span>
          </button>

          {/* Mode 2: Rotate in Order */}
          <button
            type="button"
            onClick={() => handleModeChange('ROTATE')}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              distributionMode === 'ROTATE'
                ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <div>
              <p className="font-bold text-slate-100 flex items-center justify-between">
                <span>2. Rotate in Order</span>
                {distributionMode === 'ROTATE' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Strict round-robin (M1 → M2 → M3 → M4 → M1...).</p>
            </div>
            <span className="text-[10px] text-emerald-400 mt-2 font-mono font-bold">Recommended for Safety ⭐</span>
          </button>

          {/* Mode 3: Random */}
          <button
            type="button"
            onClick={() => handleModeChange('RANDOM')}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              distributionMode === 'RANDOM'
                ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <div>
              <p className="font-bold text-slate-100 flex items-center justify-between">
                <span>3. Random Pick</span>
                {distributionMode === 'RANDOM' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Uniform deterministic random pick per recipient.</p>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">Deterministic Seed</span>
          </button>

          {/* Mode 4: Weighted */}
          <button
            type="button"
            onClick={() => handleModeChange('WEIGHTED')}
            className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
              distributionMode === 'WEIGHTED'
                ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <div>
              <p className="font-bold text-slate-100 flex items-center justify-between">
                <span>4. Weighted Split</span>
                {distributionMode === 'WEIGHTED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Custom percentage splits (e.g., 50% A / 50% B).</p>
            </div>
            <span className="text-[10px] text-sky-400 mt-2 font-mono">A/B Testing</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. SINGLE MESSAGE COMPOSER (When in Single Mode)          */}
      {/* ========================================================= */}
      {distributionMode === 'SINGLE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Single Broadcast Composer</h3>
            {/* Media Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              {(['text', 'image', 'video', 'document'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSingleMediaTypeChange(m)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition ${
                    singleMediaType === m ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Media Attach Fields */}
          {singleMediaType !== 'text' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Media Public URL ({singleMediaType})
                </label>
                <input
                  type="url"
                  value={singleMediaUrl}
                  onChange={(e) => onSingleMediaUrlChange(e.target.value)}
                  placeholder="https://example.com/asset.png"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">File Name (Optional)</label>
                <input
                  type="text"
                  value={singleFileName}
                  onChange={(e) => onSingleFileNameChange(e.target.value)}
                  placeholder="brochure.pdf"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          )}

          {/* Variable chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Insert:</span>
            <button
              type="button"
              onClick={() => onSingleTemplateChange(singleTemplate + ' {{name}}')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono"
            >
              + name
            </button>
            <button
              type="button"
              onClick={() => onSingleTemplateChange(singleTemplate + ' {{company}}')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono"
            >
              + company
            </button>
            <button
              type="button"
              onClick={() => onSingleTemplateChange(singleTemplate + ' {Hi|Hello|Dear}')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-teal-400 font-mono"
            >
              + spintax greeting
            </button>
            <button
              type="button"
              onClick={() => onSingleTemplateChange(singleTemplate + ' *bold*')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
            >
              *bold*
            </button>
          </div>

          <textarea
            rows={6}
            required
            value={singleTemplate}
            onChange={(e) => onSingleTemplateChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono leading-relaxed"
            placeholder="Type your message text or spintax here..."
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MULTI-MESSAGE ROTATION EDITOR (Modes 2-4)               */}
      {/* ========================================================= */}
      {distributionMode !== 'SINGLE' && (
        <div className="space-y-4">
          {/* Action Bar & Variation Helper */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Message Variants ({variants.length} of 8 max)</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateVariations}
                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer"
                title="Automatically generate 4 distinct tone variations"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Generate 4 Variations</span>
              </button>

              <button
                type="button"
                disabled={variants.length >= 8}
                onClick={handleAddVariant}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  variants.length < 8
                    ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Message</span>
              </button>
            </div>
          </div>

          {/* Rotation Order Preview Strip (Section 2) */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Rotation Sequence Strip (First 12 Recipients)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Clean audience spread with no skipped gaps
              </span>
            </div>

            {/* Sequence Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {previewStrip.map((item) => (
                <div
                  key={item.recipientIdx}
                  onClick={() => {
                    const idx = item.variantPos - 1;
                    setEditingCardIndex(idx);
                    onActivePreviewVariantIndexChange(idx);
                  }}
                  className={`flex flex-col items-center justify-center min-w-[54px] py-1.5 px-2 rounded-xl border cursor-pointer transition hover:scale-105 shrink-0 ${item.color.bg} ${item.color.text} ${item.color.border}`}
                  title={`Recipient #${item.recipientIdx} will receive "${variants[item.variantPos - 1]?.label || item.label}"`}
                >
                  <span className="text-[9px] opacity-70 font-mono">R{item.recipientIdx}</span>
                  <span className="font-bold text-xs">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Distribution Summary Bar */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Audience Spread Projection (~{totalRecipientsCount} contacts):</span>
                <span>
                  ~{Math.round(totalRecipientsCount / variants.length)} per message (
                  {Math.round(100 / variants.length)}%)
                </span>
              </div>

              {/* Segmented Bar */}
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden flex">
                {variants.map((v, i) => {
                  const color = badgeColors[i % badgeColors.length]!;
                  const pct = distributionMode === 'WEIGHTED' ? v.weight || 25 : 100 / variants.length;
                  return (
                    <div
                      key={v.position}
                      className={`${color.bar} h-full transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                      title={`${v.label}: ${pct}%`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Duplicate Detector Warning Banner (Section 2) */}
          {duplicateAlerts.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-300">Duplicate Message Warning Detected</p>
                {duplicateAlerts.map((da, idx) => (
                  <p key={idx} className="text-[11px] text-amber-200/90 leading-relaxed">
                    • {da.warning}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Variant Selector Tabs / Accordion Headings */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {variants.map((v, idx) => {
              const color = badgeColors[idx % badgeColors.length]!;
              const isSelected = editingCardIndex === idx;
              return (
                <button
                  key={v.position}
                  type="button"
                  onClick={() => {
                    setEditingCardIndex(idx);
                    onActivePreviewVariantIndexChange(idx);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? `bg-slate-800 text-white border ${color.border} shadow-md`
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${color.bar}`} />
                  <span>{v.label || `Message ${v.position}`}</span>
                  {distributionMode === 'WEIGHTED' && (
                    <span className="text-[10px] font-mono text-slate-400">({v.weight || 25}%)</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Message Card Composer */}
          {variants[editingCardIndex] && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              {/* Card Header & Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Message {variants[editingCardIndex]!.position} Settings
                  </span>
                  <input
                    type="text"
                    value={variants[editingCardIndex]!.label}
                    onChange={(e) => handleUpdateCard(editingCardIndex, { label: e.target.value })}
                    placeholder="e.g. Friendly Tone"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-semibold w-44"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={editingCardIndex === 0}
                    onClick={() => handleMoveVariant(editingCardIndex, 'up')}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg transition"
                    title="Move earlier in sequence"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={editingCardIndex === variants.length - 1}
                    onClick={() => handleMoveVariant(editingCardIndex, 'down')}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded-lg transition"
                    title="Move later in sequence"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateVariant(editingCardIndex)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                    title="Duplicate this message card"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={variants.length <= 2}
                    onClick={() => handleRemoveVariant(editingCardIndex)}
                    className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-rose-400 disabled:opacity-30 rounded-lg transition"
                    title="Delete this message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Weighted Mode Slider (if applicable) */}
              {distributionMode === 'WEIGHTED' && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Message Weight Split</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {variants[editingCardIndex]!.weight || 25}% of sends
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    step={5}
                    value={variants[editingCardIndex]!.weight || 25}
                    onChange={(e) => {
                      const newW = Number(e.target.value);
                      handleUpdateCard(editingCardIndex, { weight: newW });
                    }}
                    className="w-full accent-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    Adjust slider to allocate what percentage of contacts receive this specific variant.
                  </p>
                </div>
              )}

              {/* Media Attachment Selector for this Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">Attached Media</span>
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                    {(['text', 'image', 'video', 'document'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleUpdateCard(editingCardIndex, { mediaType: m })}
                        className={`px-2 py-0.5 rounded capitalize ${
                          variants[editingCardIndex]!.mediaType === m
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'text-slate-400'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {variants[editingCardIndex]!.mediaType && variants[editingCardIndex]!.mediaType !== 'text' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Media Public URL ({variants[editingCardIndex]!.mediaType})
                      </label>
                      <input
                        type="url"
                        value={variants[editingCardIndex]!.mediaUrl || ''}
                        onChange={(e) => handleUpdateCard(editingCardIndex, { mediaUrl: e.target.value })}
                        placeholder="https://example.com/asset.png"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">File Name (Optional)</label>
                      <input
                        type="text"
                        value={variants[editingCardIndex]!.fileName || ''}
                        onChange={(e) => handleUpdateCard(editingCardIndex, { fileName: e.target.value })}
                        placeholder="brochure.pdf"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Formatting Toolbar & Variables */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 mr-1">Insert:</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateCard(editingCardIndex, {
                        content: variants[editingCardIndex]!.content + ' {{name}}',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono"
                  >
                    + name
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateCard(editingCardIndex, {
                        content: variants[editingCardIndex]!.content + ' {{company}}',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono"
                  >
                    + company
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateCard(editingCardIndex, {
                        content: variants[editingCardIndex]!.content + ' {Hi|Hello|Dear}',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-teal-400 font-mono"
                  >
                    + spintax
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateCard(editingCardIndex, {
                        content: variants[editingCardIndex]!.content + ' *bold*',
                      })
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono"
                  >
                    *bold*
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  {variants[editingCardIndex]!.content.length} chars |{' '}
                  {countSpintaxVariations(variants[editingCardIndex]!.content)} spintax variants
                </div>
              </div>

              {/* Main Content Textarea */}
              <textarea
                rows={5}
                required
                value={variants[editingCardIndex]!.content}
                onChange={(e) => handleUpdateCard(editingCardIndex, { content: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono leading-relaxed"
                placeholder="Compose unique wording for this message variant..."
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. ADVANCED ROTATION SETTINGS (Section 3)                 */}
          {/* ========================================================= */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-300 hover:bg-slate-900 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Advanced Multi-Message Rotation Settings</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 pt-1 border-t border-slate-800/80 space-y-4 text-xs">
                {/* Scope selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Rotation Scope</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => onRotationScopeChange('CAMPAIGN')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        rotationScope === 'CAMPAIGN'
                          ? 'bg-emerald-600/20 border-emerald-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      <p className="font-bold text-slate-200">Whole Campaign</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Strict sequence across all numbers (Default)</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRotationScopeChange('INSTANCE')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        rotationScope === 'INSTANCE'
                          ? 'bg-emerald-600/20 border-emerald-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      <p className="font-bold text-slate-200">Per Sending Number</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Each WhatsApp instance runs its own 1-2-3-4 cycle</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRotationScopeChange('LIST')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        rotationScope === 'LIST'
                          ? 'bg-emerald-600/20 border-emerald-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      <p className="font-bold text-slate-200">Per Contact List</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Each contact list rotates independently</p>
                    </button>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={avoidRepeatContent}
                      onChange={(e) => onAvoidRepeatContentChange(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-slate-200">
                      Cross-Campaign Diversity Protection (Recommended)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-6">
                    If a contact previously received Message 1 from this number in the last 30 days, automatically shifts to Message 2 or 3 to avoid content fatigue.
                  </p>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-2">
                    <input
                      type="checkbox"
                      checked={shuffleAudience}
                      onChange={(e) => onShuffleAudienceChange(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-slate-200">
                      Shuffle Audience Order with Deterministic Seed
                    </span>
                  </label>
                  {shuffleAudience && (
                    <div className="pl-6 pt-1 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Random Seed:</span>
                      <input
                        type="number"
                        value={shuffleSeed}
                        onChange={(e) => onShuffleSeedChange(Number(e.target.value))}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs text-white font-mono w-20"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
