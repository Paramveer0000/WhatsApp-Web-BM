'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Upload,
  X,
  Check,
  Loader2,
  Link,
  MessageSquare,
  Split,
  Bot,
} from 'lucide-react';
import {
  DistributionMode,
  RotationScope,
  VariantInput,
  detectDuplicateVariants,
  calculateJaccardSimilarity,
} from '@/lib/rotation';
import {
  AllocationStrategy,
  assignTwoLayerDistribution,
  MAX_VARIANTS,
} from '@/lib/distribution';
import { countSpintaxVariations } from '@/lib/spintax';
import { toast } from '@/lib/toast';

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
  selectedInstances?: any[];
  allocationStrategy?: AllocationStrategy;
  onAllocationStrategyChange?: (strategy: AllocationStrategy) => void;
  blockSize?: number;
  onBlockSizeChange?: (size: number) => void;
  randomizeBlockSize?: boolean;
  onRandomizeBlockSizeChange?: (randomize: boolean) => void;
  staggerVariations?: boolean;
  onStaggerVariationsChange?: (stagger: boolean) => void;
  failoverEnabled?: boolean;
  onFailoverEnabledChange?: (failover: boolean) => void;
  stickyConversations?: boolean;
  onStickyConversationsChange?: (sticky: boolean) => void;
}

function MediaUploadInput({
  mediaType,
  mediaUrl,
  fileName,
  onMediaUrlChange,
  onFileNameChange,
}: {
  mediaType: string;
  mediaUrl: string;
  fileName: string;
  onMediaUrlChange: (url: string) => void;
  onFileNameChange: (name: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [useUrlMode, setUseUrlMode] = useState(false);

  const acceptMap: Record<string, string> = {
    image: 'image/png,image/jpeg,image/webp,image/gif',
    video: 'video/mp4,video/quicktime,video/webm',
    document: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv',
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onMediaUrlChange(data.url || data.base64);
      onFileNameChange(data.fileName || file.name);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onMediaUrlChange('');
    onFileNameChange('');
    setUploadError('');
  };

  if (useUrlMode) {
    return (
      <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-300">
            Media Public URL ({mediaType})
          </label>
          <button
            type="button"
            onClick={() => setUseUrlMode(false)}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
          >
            <Upload className="w-3 h-3" />
            <span>Switch to File Upload</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="url"
            value={mediaUrl}
            onChange={(e) => onMediaUrlChange(e.target.value)}
            placeholder="https://example.com/asset.png"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
          />
          <input
            type="text"
            value={fileName}
            onChange={(e) => onFileNameChange(e.target.value)}
            placeholder="File name (Optional)"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 capitalize">
          Attach {mediaType} File
        </span>
        <button
          type="button"
          onClick={() => setUseUrlMode(true)}
          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
        >
          <Link className="w-3 h-3 text-slate-400" />
          <span>Or enter public URL</span>
        </button>
      </div>

      {uploadError && (
        <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded">
          {uploadError}
        </div>
      )}

      {mediaUrl ? (
        <div className="flex items-center justify-between gap-3 bg-slate-900 p-2.5 rounded-xl border border-emerald-500/30">
          <div className="flex items-center gap-3 min-w-0">
            {mediaType === 'image' ? (
              <img
                src={mediaUrl}
                alt="Uploaded thumbnail"
                className="w-14 h-14 object-cover rounded-lg border border-slate-700 shrink-0 bg-slate-950"
              />
            ) : mediaType === 'video' ? (
              <div className="w-14 h-14 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                <Video className="w-6 h-6" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg bg-teal-950/60 border border-teal-500/30 flex items-center justify-center shrink-0 text-teal-400">
                <FileText className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate max-w-[240px]">
                {fileName || `${mediaType}_file`}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-mono">Ready to broadcast</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition shrink-0"
            title="Remove media"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 rounded-xl p-4 bg-slate-900/50 hover:bg-slate-900 cursor-pointer transition text-center group">
          {isUploading ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading {mediaType}...</span>
            </div>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5 transition">
                <Upload className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                Click to upload <span className="capitalize">{mediaType}</span> or drag & drop
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {mediaType === 'image'
                  ? 'PNG, JPG, WEBP, GIF up to 50MB'
                  : mediaType === 'video'
                  ? 'MP4, WebM up to 50MB'
                  : 'PDF, DOC, XLSX, CSV up to 50MB'}
              </p>
            </>
          )}
          <input
            type="file"
            accept={acceptMap[mediaType] || '*/*'}
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

// 16 distinct color palettes for variation badges
const badgeColors = [
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', bar: 'bg-emerald-500' },
  { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/40', bar: 'bg-sky-500' },
  { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40', bar: 'bg-purple-500' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40', bar: 'bg-amber-500' },
  { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40', bar: 'bg-rose-500' },
  { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/40', bar: 'bg-indigo-500' },
  { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/40', bar: 'bg-teal-500' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/40', bar: 'bg-cyan-500' },
  { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/40', bar: 'bg-fuchsia-500' },
  { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/40', bar: 'bg-orange-500' },
  { bg: 'bg-lime-500/20', text: 'text-lime-300', border: 'border-lime-500/40', bar: 'bg-lime-500' },
  { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/40', bar: 'bg-pink-500' },
  { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/40', bar: 'bg-violet-500' },
  { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/40', bar: 'bg-yellow-500' },
  { bg: 'bg-emerald-600/20', text: 'text-emerald-200', border: 'border-emerald-600/40', bar: 'bg-emerald-600' },
  { bg: 'bg-blue-600/20', text: 'text-blue-200', border: 'border-blue-600/40', bar: 'bg-blue-600' },
];

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
  totalRecipientsCount = 100,
  selectedInstances = [],
  allocationStrategy = 'BLOCKS',
  onAllocationStrategyChange,
  blockSize = 4,
  onBlockSizeChange,
  randomizeBlockSize = false,
  onRandomizeBlockSizeChange,
  staggerVariations = true,
  onStaggerVariationsChange,
  failoverEnabled = true,
  onFailoverEnabledChange,
  stickyConversations = true,
  onStickyConversationsChange,
}: MultiMessageRotationEditorProps) {
  // 1. Number of variations to create (user requested stepper/input)
  const [variationCount, setVariationCount] = useState<number>(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingCardIndex, setEditingCardIndex] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync editing card index if out of bounds
  useEffect(() => {
    if (editingCardIndex >= variants.length && variants.length > 0) {
      setEditingCardIndex(0);
      onActivePreviewVariantIndexChange(0);
    }
  }, [variants.length, editingCardIndex, onActivePreviewVariantIndexChange]);

  // Current base message text (synchronized with singleTemplate and variants[0])
  const baseMessageText = variants[0]?.content || singleTemplate || '';

  const handleBaseMessageChange = (newText: string) => {
    onSingleTemplateChange(newText);
    if (variants.length === 0) {
      onVariantsChange([
        {
          position: 1,
          label: 'Message 1 (Base)',
          content: newText,
          mediaType: singleMediaType || 'text',
          mediaUrl: singleMediaUrl || '',
          fileName: singleFileName || '',
          weight: 100,
        },
      ]);
    } else {
      const updated = variants.map((v, i) =>
        i === 0 ? { ...v, content: newText } : v
      );
      onVariantsChange(updated);
    }
  };

  // Step 2 Action: Take input text, take number of variations, generate with AI
  const handleGenerateVariations = async () => {
    const textToVary = baseMessageText.trim();
    if (!textToVary) {
      toast.warning('Please enter your base message text first.');
      return;
    }

    const requestedCount = Math.max(1, Math.min(19, variationCount));
    setIsGenerating(true);

    try {
      const res = await fetch('/api/ai/variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseMessage: textToVary,
          count: requestedCount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate variations');

      const returnedVariations: { label: string; content: string }[] =
        data.variations || [];

      // Total variants = 1 (original base message) + N (generated variations)
      const totalCount = 1 + returnedVariations.length;
      const equalWeight = Math.floor(100 / totalCount);

      const baseVariant: VariantInput = {
        position: 1,
        label: 'Message 1 (Base)',
        content: textToVary,
        mediaType: singleMediaType || 'text',
        mediaUrl: singleMediaUrl || '',
        fileName: singleFileName || '',
        weight: equalWeight,
      };

      const newVariants: VariantInput[] = [
        baseVariant,
        ...returnedVariations.map((item, idx) => ({
          position: idx + 2,
          label: item.label || `Message ${idx + 2}`,
          content: item.content,
          mediaType: baseVariant.mediaType,
          mediaUrl: baseVariant.mediaUrl,
          fileName: baseVariant.fileName,
          weight: equalWeight,
        })),
      ];

      // Rebalance remainder weight on first variant
      const sumWeight = newVariants.reduce((s, v) => s + (v.weight || 0), 0);
      if (sumWeight < 100) {
        newVariants[0]!.weight = (newVariants[0]!.weight || 0) + (100 - sumWeight);
      }

      onVariantsChange(newVariants);
      onDistributionModeChange('ROTATE'); // Automatically switch to Rotate mode
      setEditingCardIndex(0);
      onActivePreviewVariantIndexChange(0);

      const instCount = selectedInstances.length || 1;
      toast.success(
        `Generated ${returnedVariations.length} polite variations! Automatically split across ${instCount} WhatsApp number${instCount > 1 ? 's' : ''}.`,
        'Message Variations Ready'
      );
    } catch (err: any) {
      toast.error(err.message || 'Error generating variations', 'AI Generation Failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 3: Compute how variants are split across instances
  const instanceSplitMap = useMemo(() => {
    const activeInstances =
      selectedInstances.length > 0
        ? selectedInstances
        : [{ id: 'default', name: 'Primary WhatsApp Number', phone: '' }];

    const map: Record<
      string,
      {
        instance: any;
        assignedVariants: VariantInput[];
        sharePercent: number;
      }
    > = {};

    activeInstances.forEach((inst, instIdx) => {
      map[inst.id || inst.name || `inst_${instIdx}`] = {
        instance: inst,
        assignedVariants: [],
        sharePercent: Math.round(100 / activeInstances.length),
      };
    });

    const activeList =
      variants.length > 0
        ? variants
        : [
            {
              position: 1,
              label: 'Message 1 (Base)',
              content: baseMessageText || 'Hello {name}',
              weight: 100,
            },
          ];

    // Split variants across instances in balanced round-robin
    activeList.forEach((v, idx) => {
      const targetInst = activeInstances[idx % activeInstances.length]!;
      const key = targetInst.id || targetInst.name || `inst_${idx % activeInstances.length}`;
      if (map[key]) {
        map[key]!.assignedVariants.push(v);
      }
    });

    return map;
  }, [selectedInstances, variants, baseMessageText]);

  // Two-layer distribution simulation for full preview
  const twoLayerData = useMemo(() => {
    if (selectedInstances.length < 2) return null;
    const sampleSize = Math.min(100, Math.max(10, totalRecipientsCount));
    const sampleContacts = Array.from({ length: sampleSize }, (_, idx) => ({
      id: `rec_${idx + 1}`,
      phone: `9198000000${String(idx + 1).padStart(2, '0')}`,
      name: `Recipient ${idx + 1}`,
    }));

    const mappedInstances = selectedInstances.map((i) => ({
      id: i.id || i.name,
      name: i.name,
      phone: i.phone,
      dailyQuota: i.dailyQuota || 200,
      todaySent: i.todaySent || 0,
      capacity: Math.max(0, (i.dailyQuota || 200) - (i.todaySent || 0)),
      healthy: i.status?.toUpperCase() === 'OPEN' || i.connectionStatus === 'open',
    }));

    const activeVList =
      variants.length > 0
        ? variants
        : [{ position: 1, label: 'Message 1', content: baseMessageText || 'Hello {name}', weight: 100 }];

    return assignTwoLayerDistribution({
      contacts: sampleContacts,
      instances: mappedInstances,
      variants: activeVList,
      allocationStrategy,
      blockSize: Math.max(1, blockSize),
      blockSizeMax: randomizeBlockSize ? blockSize + 3 : undefined,
      distributionMode,
      rotationScope,
      staggerVariations,
      stickyConversations,
    });
  }, [
    selectedInstances,
    totalRecipientsCount,
    variants,
    baseMessageText,
    allocationStrategy,
    blockSize,
    randomizeBlockSize,
    distributionMode,
    rotationScope,
    staggerVariations,
    stickyConversations,
  ]);

  // Variant editing handlers
  const handleUpdateVariant = (index: number, patch: Partial<VariantInput>) => {
    const updated = variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onVariantsChange(updated);
    if (index === 0 && patch.content !== undefined) {
      onSingleTemplateChange(patch.content);
    }
  };

  const handleAddManualVariant = () => {
    if (variants.length >= 20) {
      toast.warning('Maximum 20 message variants allowed.');
      return;
    }
    const newPos = variants.length + 1;
    const equalWeight = Math.floor(100 / newPos);
    const updated: VariantInput[] = [
      ...variants.map((v) => ({ ...v, weight: equalWeight })),
      {
        position: newPos,
        label: `Message ${newPos}`,
        content: `Hello {name|friend}! Here is another gentle variation of your announcement.`,
        mediaType: singleMediaType || 'text',
        mediaUrl: singleMediaUrl || '',
        fileName: singleFileName || '',
        weight: equalWeight,
      },
    ];
    onVariantsChange(updated);
    setEditingCardIndex(updated.length - 1);
    onActivePreviewVariantIndexChange(updated.length - 1);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      toast.warning('At least 1 message is required.');
      return;
    }
    const filtered = variants
      .filter((_, i) => i !== index)
      .map((v, i) => ({
        ...v,
        position: i + 1,
        label: v.label.startsWith('Message ') ? `Message ${i + 1}` : v.label,
      }));
    onVariantsChange(filtered);
    const newIdx = Math.max(0, Math.min(editingCardIndex, filtered.length - 1));
    setEditingCardIndex(newIdx);
    onActivePreviewVariantIndexChange(newIdx);
  };

  // Duplicate alerts
  const duplicateAlerts = useMemo(() => {
    if (variants.length < 2) return [];
    return detectDuplicateVariants(variants, 0.85);
  }, [variants]);

  return (
    <div className="space-y-4">
      {/* ========================================================= */}
      {/* STEP 1: TAKE INPUT TEXT (BASE MESSAGE COMPOSER)           */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Base Message Text</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 lowercase">
                  foundation for ai variations
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Type your core message below. This serves as Message 1 and the exact meaning for all variations.
              </p>
            </div>
          </div>

          {/* Media Attachment Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
            {(['text', 'image', 'video', 'document'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                onSingleMediaTypeChange(m);
                if (variants && variants.length > 0) {
                  onVariantsChange(variants.map(v => ({
                    ...v,
                    mediaType: m,
                    mediaUrl: m === 'text' ? '' : (v.mediaUrl || singleMediaUrl),
                  })));
                }
              }}
                className={`px-2.5 py-1 rounded-lg capitalize transition cursor-pointer ${
                  singleMediaType === m
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Media Upload Area (if media selected) */}
        {singleMediaType !== 'text' && (
          <MediaUploadInput
            mediaType={singleMediaType}
            mediaUrl={singleMediaUrl}
            fileName={singleFileName}
            onMediaUrlChange={(url) => {
              onSingleMediaUrlChange(url);
              if (variants && variants.length > 0) {
                onVariantsChange(variants.map(v => ({
                  ...v,
                  mediaType: singleMediaType || 'image',
                  mediaUrl: url,
                  fileName: singleFileName,
                })));
              }
            }}
            onFileNameChange={(name) => {
              onSingleFileNameChange(name);
              if (variants && variants.length > 0) {
                onVariantsChange(variants.map(v => ({
                  ...v,
                  fileName: name,
                })));
              }
            }}
          />
        )}

        {/* Dynamic Tokens & Format Helper Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 mr-1">Insert:</span>
            <button
              type="button"
              onClick={() => handleBaseMessageChange(baseMessageText + ' {name}')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono transition cursor-pointer"
              title="Inserts recipient name (with fallback 'friend')"
            >
              + name
            </button>
            <button
              type="button"
              onClick={() => handleBaseMessageChange(baseMessageText + ' {company}')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono transition cursor-pointer"
              title="Inserts company name"
            >
              + company
            </button>
            <button
              type="button"
              onClick={() => handleBaseMessageChange(baseMessageText + ' *bold text*')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono transition cursor-pointer"
            >
              *bold*
            </button>
            <button
              type="button"
              onClick={() => handleBaseMessageChange(baseMessageText + ' _italic text_')}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono transition cursor-pointer"
            >
              _italic_
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            {baseMessageText.length} chars |{' '}
            {countSpintaxVariations(baseMessageText)} spintax combinations
          </div>
        </div>

        {/* Base Message Textarea */}
        <textarea
          rows={5}
          required
          value={baseMessageText}
          onChange={(e) => handleBaseMessageChange(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:border-emerald-500 focus:outline-none transition resize-y"
          placeholder="Type your broadcast message text here... (e.g. Hello {name}! We are excited to announce our new special offer. Use code SAVE20 for 20% off!)"
        />
      </div>

      {/* ========================================================= */}
      {/* STEP 2: NUMBER OF VARIATIONS & GENERATE WITH AI           */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>AI Message Variation Generator</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  Warm & Polite Wordplay
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Specify how many variations you want to create. The exact meaning, offer, and codes will remain 100% intact.
              </p>
            </div>
          </div>

          {/* Stepper Input & Action Button */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Number of Variations Stepper */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
              <span className="text-xs text-slate-300 font-medium">Variations to create:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setVariationCount((prev) => Math.max(1, prev - 1))}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center transition cursor-pointer"
                  disabled={variationCount <= 1}
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={19}
                  value={variationCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setVariationCount(Math.max(1, Math.min(19, val)));
                  }}
                  className="w-10 bg-slate-900 border border-slate-700 rounded text-center text-xs text-white font-mono font-bold py-0.5"
                />
                <button
                  type="button"
                  onClick={() => setVariationCount((prev) => Math.min(19, prev + 1))}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center transition cursor-pointer"
                  disabled={variationCount >= 19}
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick preset chips */}
            <div className="hidden sm:flex items-center gap-1 text-[11px]">
              {[2, 4, 6, 8, 12].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setVariationCount(num)}
                  className={`px-2 py-1 rounded-lg font-mono transition cursor-pointer ${
                    variationCount === num
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* GENERATE BUTTON */}
            <button
              type="button"
              disabled={isGenerating || !baseMessageText.trim()}
              onClick={handleGenerateVariations}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 transition cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating {variationCount} Variations...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Variations ({variationCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* STEP 3: ALL GENERATED MESSAGES SPLIT TO INSTANCES         */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Message Distribution Split Across Numbers</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  {variants.length} Message{variants.length !== 1 ? 's' : ''} Active
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {selectedInstances.length >= 2
                  ? `Each WhatsApp number is assigned its share of message variations to prevent pattern detection.`
                  : `Currently broadcasting with 1 WhatsApp number. (Select 2+ numbers in Step 1 to split across parallel sending lines).`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={variants.length >= 20 || isGenerating}
              onClick={handleAddManualVariant}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Message</span>
            </button>
          </div>
        </div>

        {/* Visual Split Cards per Instance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(instanceSplitMap).map(([instKey, data], instIdx) => {
            const inst = data.instance;
            const assignedList = data.assignedVariants;
            return (
              <div
                key={instKey}
                className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-md"
              >
                {/* Instance Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-white text-sm">
                      {inst.name || `WhatsApp Number ${instIdx + 1}`}
                    </span>
                    {inst.phone && (
                      <span className="text-[11px] font-mono text-slate-400">({inst.phone})</span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Lane #{instIdx + 1} • ~{data.sharePercent}% sends
                  </span>
                </div>

                {/* Assigned Message Chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Assigned Variations ({assignedList.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {assignedList.map((v) => {
                      const vIdx = v.position - 1;
                      const col = badgeColors[vIdx % badgeColors.length]!;
                      const isSelected = editingCardIndex === vIdx;
                      return (
                        <button
                          key={v.position}
                          type="button"
                          onClick={() => {
                            setEditingCardIndex(vIdx);
                            onActivePreviewVariantIndexChange(vIdx);
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition cursor-pointer ${
                            col.bg
                          } ${col.text} ${col.border} ${
                            isSelected ? 'ring-2 ring-white scale-105 shadow-md' : 'hover:scale-102'
                          }`}
                          title={`Click to inspect or edit ${v.label}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${col.bar}`} />
                          <span className="font-bold text-xs">M{v.position}</span>
                          <span className="text-[11px] opacity-90 truncate max-w-[120px]">
                            {v.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recipient Projection Sample */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Audience target:</span>
                  <span className="text-emerald-400">
                    ~{Math.round(totalRecipientsCount / Math.max(1, Object.keys(instanceSplitMap).length))} contacts
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Broadcast Simulation Lanes (when multiple instances connected) */}
        {twoLayerData && Object.keys(twoLayerData.lanes).length >= 2 && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Simulated Parallel Send Sequence</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Click any chip to preview message in phone simulator
              </span>
            </div>

            <div className="space-y-2">
              {Object.entries(twoLayerData.lanes).map(([instId, items], laneIdx) => {
                const instObj = selectedInstances.find(
                  (i) => i.id === instId || i.name === instId
                );
                const instName = instObj?.name || instId;

                return (
                  <div key={instId} className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                    <span className="font-mono font-bold text-emerald-400 text-[11px] shrink-0 min-w-[70px]">
                      {instName}:
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {items.slice(0, 12).map((item) => {
                        const vPos = item.variantPosition || 1;
                        const badgeCol = badgeColors[(vPos - 1) % badgeColors.length]!;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              const idx = (item.variantPosition || 1) - 1;
                              setEditingCardIndex(idx);
                              onActivePreviewVariantIndexChange(idx);
                            }}
                            className={`flex flex-col items-center justify-center min-w-[50px] py-1 px-1.5 rounded-lg border cursor-pointer transition hover:scale-105 shrink-0 ${badgeCol.bg} ${badgeCol.text} ${badgeCol.border}`}
                            title={`${instName} sending M${vPos} to ${item.name || item.phone}`}
                          >
                            <span className="text-[9px] opacity-70 font-mono">
                              R{item.allocationIndex + 1}
                            </span>
                            <span className="font-bold text-[10px]">M{vPos}</span>
                          </button>
                        );
                      })}
                      {items.length > 12 && (
                        <span className="text-[10px] text-slate-500 font-mono pl-1 shrink-0">
                          +{items.length - 12} more...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* STEP 4: INSPECT & EDIT ANY GENERATED VARIATION            */}
      {/* ========================================================= */}
      {variants.length > 0 && variants[editingCardIndex] && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            {/* Variation Selection Pills */}
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
                    <span>M{v.position}</span>
                    <span className="text-[10px] font-normal opacity-80 truncate max-w-[80px]">
                      ({v.label})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Actions for Selected Card */}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={variants[editingCardIndex]!.label}
                onChange={(e) => handleUpdateVariant(editingCardIndex, { label: e.target.value })}
                placeholder="Variant Label"
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-semibold w-40"
              />
              <button
                type="button"
                disabled={variants.length <= 1}
                onClick={() => handleRemoveVariant(editingCardIndex)}
                className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-rose-400 disabled:opacity-30 rounded-lg transition cursor-pointer"
                title="Delete this variation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Duplicate Warnings */}
          {duplicateAlerts.length > 0 && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
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

          {/* Card Formatting Helpers */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1">Insert:</span>
              <button
                type="button"
                onClick={() =>
                  handleUpdateVariant(editingCardIndex, {
                    content: variants[editingCardIndex]!.content + ' {name}',
                  })
                }
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono transition cursor-pointer"
              >
                + name
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateVariant(editingCardIndex, {
                    content: variants[editingCardIndex]!.content + ' {company}',
                  })
                }
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-400 font-mono transition cursor-pointer"
              >
                + company
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateVariant(editingCardIndex, {
                    content: variants[editingCardIndex]!.content + ' *bold*',
                  })
                }
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-mono transition cursor-pointer"
              >
                *bold*
              </button>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              {variants[editingCardIndex]!.content.length} chars |{' '}
              {countSpintaxVariations(variants[editingCardIndex]!.content)} spintax variations
            </div>
          </div>

          {/* Active Variation Textarea */}
          <textarea
            rows={4}
            required
            value={variants[editingCardIndex]!.content}
            onChange={(e) => handleUpdateVariant(editingCardIndex, { content: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:border-emerald-500 focus:outline-none transition resize-y"
            placeholder="Edit text for this variation..."
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 5: ADVANCED ROUTING & SAFETY (COLLAPSIBLE)            */}
      {/* ========================================================= */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-300 hover:bg-slate-900 transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            <span>Advanced Rotation & Anti-Ban Routing Options</span>
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="p-4 pt-1 border-t border-slate-800/80 space-y-4 text-xs">
            {/* Rotation Mode */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                Rotation Order Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onDistributionModeChange('ROTATE')}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    distributionMode === 'ROTATE'
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                  }`}
                >
                  <p className="font-bold text-slate-200">Rotate in Order (Recommended)</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Strict round-robin (M1 → M2 → M3 → M4...)
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDistributionModeChange('RANDOM')}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    distributionMode === 'RANDOM'
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                  }`}
                >
                  <p className="font-bold text-slate-200">Random Pick</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Deterministic seed random selection
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDistributionModeChange('SINGLE')}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    distributionMode === 'SINGLE'
                      ? 'bg-emerald-600/20 border-emerald-500 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                  }`}
                >
                  <p className="font-bold text-slate-200">Single Template Only</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Broadcasts only Message 1 to everyone
                  </p>
                </button>
              </div>
            </div>

            {/* Block Size & Safety Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={staggerVariations}
                  onChange={(e) => onStaggerVariationsChange && onStaggerVariationsChange(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-200 block text-[11px]">
                    Stagger Variations
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Number 1 starts at M1, Number 2 at M2
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={failoverEnabled}
                  onChange={(e) => onFailoverEnabledChange && onFailoverEnabledChange(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-200 block text-[11px]">
                    Failover Protection
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Auto-migrates queue if a number disconnects
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stickyConversations}
                  onChange={(e) => onStickyConversationsChange && onStickyConversationsChange(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-200 block text-[11px]">
                    Sticky Conversations
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Keeps prior contacts on same number
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
