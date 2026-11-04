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
  Upload,
  X,
  Check,
  Loader2,
  Link,
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
  // Two-Layer Distribution Props (Layer 1: Number Distribution)
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
      onMediaUrlChange(data.base64 || data.url);
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
  selectedInstances = [],
  allocationStrategy = 'BLOCKS',
  onAllocationStrategyChange,
  blockSize = 5,
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewRecipientNumber, setPreviewRecipientNumber] = useState(1);
  const [editingCardIndex, setEditingCardIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewViewMode, setPreviewViewMode] = useState<'lanes' | 'matrix'>('lanes');
  const [matrixPage, setMatrixPage] = useState(0);
  const PREVIEW_PAGE_SIZE = 16;
  const MATRIX_PAGE_SIZE = 10;

  // Auto-switch rotationScope to 'INSTANCE' (Per Sending Number) when 2+ instances are selected
  useEffect(() => {
    if (selectedInstances.length >= 2 && rotationScope === 'CAMPAIGN' && onRotationScopeChange) {
      onRotationScopeChange('INSTANCE');
    }
  }, [selectedInstances.length, rotationScope, onRotationScopeChange]);

  // Compute live two-layer distribution
  const twoLayerData = React.useMemo(() => {
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

    const activeVList = variants.length > 0
      ? variants
      : [{ position: 1, label: 'Message 1', content: singleTemplate || 'Hello {name}', weight: 100 }];

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
    singleTemplate,
    allocationStrategy,
    blockSize,
    randomizeBlockSize,
    distributionMode,
    rotationScope,
    staggerVariations,
    stickyConversations,
  ]);

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
    if (variants.length >= 20) return;
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
      toast.warning('Multi-message campaigns require at least 2 message variants.');
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
    if (variants.length >= 20) {
      toast.warning('Maximum 20 message variants allowed.');
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

  // Intelligent Variations Generator: takes 1 base message and generates 12 AI variations (13 total)
  const handleGenerateVariations = async () => {
    const baseContent =
      variants[editingCardIndex]?.content ||
      variants[0]?.content ||
      singleTemplate ||
      '{Hi|Hello|Hey} {name|Friend}! Exciting news: we have an exclusive *20% discount* waiting for you today. Use code `SAVE20` at checkout!';

    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseMessage: baseContent, count: 12 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate variations');

      // Keep Message 1 as the original provided base message
      const totalCount = 1 + (data.variations?.length || 12);
      const equalWeight = Math.floor(100 / totalCount);

      const baseVariant: VariantInput = {
        position: 1,
        label: variants[0]?.label || 'Message 1 (Base)',
        content: baseContent,
        mediaType: variants[0]?.mediaType || singleMediaType || 'text',
        mediaUrl: variants[0]?.mediaUrl || singleMediaUrl || '',
        fileName: variants[0]?.fileName || singleFileName || '',
        weight: equalWeight,
      };

      // Add the 12 AI variations as Messages 2 to 13
      const generatedList: VariantInput[] = (data.variations || []).map((item: any, idx: number) => ({
        position: idx + 2,
        label: item.label || `Message ${idx + 2}`,
        content: item.content,
        mediaType: baseVariant.mediaType,
        mediaUrl: baseVariant.mediaUrl,
        fileName: baseVariant.fileName,
        weight: equalWeight,
      }));

      const allVariants = [baseVariant, ...generatedList];
      // Adjust remainder weight on first variant
      const sumWeight = allVariants.reduce((sum, v) => sum + (v.weight || 0), 0);
      if (sumWeight < 100) allVariants[0]!.weight = (allVariants[0]!.weight || 0) + (100 - sumWeight);

      onVariantsChange(allVariants);
      setEditingCardIndex(0);
      onActivePreviewVariantIndexChange(0);
    } catch (err: any) {
      toast.error(err.message || 'Error generating variations', 'AI Generation Failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // Detect duplicate pairs
  const duplicateAlerts = React.useMemo(() => {
    if (distributionMode === 'SINGLE' || variants.length < 2) return [];
    return detectDuplicateVariants(variants, 0.85);
  }, [variants, distributionMode]);

  // Rotation colors per message (16 vibrant palettes for up to 20 messages)
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

  // Dynamic window for sequence preview across the ENTIRE audience
  const totalAudience = Math.max(totalRecipientsCount, 1);
  const startRecipientIdx = previewPage * PREVIEW_PAGE_SIZE;
  const currentWindowSize = Math.min(PREVIEW_PAGE_SIZE, Math.max(1, totalAudience - startRecipientIdx));

  const previewStrip = Array.from({ length: currentWindowSize }, (_, i) => {
    const globalIdx = startRecipientIdx + i;
    let variantPos = 1;
    if (distributionMode === 'SINGLE' || variants.length === 0) {
      variantPos = 1;
    } else if (distributionMode === 'ROTATE') {
      variantPos = (globalIdx % variants.length) + 1;
    } else if (distributionMode === 'RANDOM') {
      variantPos = ((globalIdx * 7 + 3) % variants.length) + 1;
    } else if (distributionMode === 'WEIGHTED') {
      variantPos = (globalIdx % variants.length) + 1;
    }
    const color = badgeColors[(variantPos - 1) % badgeColors.length]!;
    return {
      recipientIdx: globalIdx + 1,
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
      {/* 0. LAYER 1: HOW TO SPLIT CONTACTS BETWEEN NUMBERS        */}
      {/* ========================================================= */}
      {selectedInstances && selectedInstances.length >= 2 ? (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 shadow-xl space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>How to Split Contacts Between Numbers</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    Layer 1
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Broadcast is partitioned across {selectedInstances.length} active WhatsApp numbers to distribute traffic naturally.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                {selectedInstances.length} Numbers Selected
              </span>
            </div>
          </div>

          {/* Strategy Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
            {/* Strategy 1: Blocks */}
            <button
              type="button"
              onClick={() => onAllocationStrategyChange && onAllocationStrategyChange('BLOCKS')}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                allocationStrategy === 'BLOCKS'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div>
                <p className="font-bold text-slate-100 flex items-center justify-between">
                  <span>1. Blocks</span>
                  {allocationStrategy === 'BLOCKS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Consecutive groups of {blockSize} contacts per number (A:1-{blockSize}, B:{blockSize + 1}-{blockSize * 2}...).
                </p>
              </div>
              <span className="text-[9px] text-emerald-400 font-bold mt-2 font-mono">Recommended ⭐</span>
            </button>

            {/* Strategy 2: Round Robin */}
            <button
              type="button"
              onClick={() => onAllocationStrategyChange && onAllocationStrategyChange('ROUND_ROBIN')}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                allocationStrategy === 'ROUND_ROBIN'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div>
                <p className="font-bold text-slate-100 flex items-center justify-between">
                  <span>2. Round-Robin</span>
                  {allocationStrategy === 'ROUND_ROBIN' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Alternates contacts 1-by-1 across numbers (C1→A, C2→B, C3→A, C4→B...).
                </p>
              </div>
              <span className="text-[9px] text-slate-400 mt-2 font-mono">1-by-1 Interleaved</span>
            </button>

            {/* Strategy 3: Proportional */}
            <button
              type="button"
              onClick={() => onAllocationStrategyChange && onAllocationStrategyChange('PROPORTIONAL')}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                allocationStrategy === 'PROPORTIONAL'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div>
                <p className="font-bold text-slate-100 flex items-center justify-between">
                  <span>3. Proportional</span>
                  {allocationStrategy === 'PROPORTIONAL' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Splits contacts proportionally by each number's remaining daily budget.
                </p>
              </div>
              <span className="text-[9px] text-sky-400 mt-2 font-mono">Capacity-Balanced</span>
            </button>

            {/* Strategy 4: Manual Weights */}
            <button
              type="button"
              onClick={() => onAllocationStrategyChange && onAllocationStrategyChange('WEIGHTED')}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                allocationStrategy === 'WEIGHTED'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div>
                <p className="font-bold text-slate-100 flex items-center justify-between">
                  <span>4. Manual Weights</span>
                  {allocationStrategy === 'WEIGHTED' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Custom percentage allocation per WhatsApp number.
                </p>
              </div>
              <span className="text-[9px] text-purple-400 mt-2 font-mono">Custom Splits</span>
            </button>

            {/* Strategy 5: Fill then Spill */}
            <button
              type="button"
              onClick={() => onAllocationStrategyChange && onAllocationStrategyChange('FILL_THEN_SPILL')}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                allocationStrategy === 'FILL_THEN_SPILL'
                  ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              <div>
                <p className="font-bold text-slate-100 flex items-center justify-between">
                  <span>5. Fill-then-Spill</span>
                  {allocationStrategy === 'FILL_THEN_SPILL' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Fills primary number up to limit before spilling to secondary numbers.
                </p>
              </div>
              <span className="text-[9px] text-amber-400 mt-2 font-mono">Sequential Cap</span>
            </button>
          </div>

          {/* Block Size Stepper (When BLOCKS is active) */}
          {allocationStrategy === 'BLOCKS' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-200">Block Size (Contacts Per Number):</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Each number will send a block of {blockSize} contacts before rotating to the next number. (Default matches your {variants.length} message variations).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
                  <button
                    type="button"
                    disabled={blockSize <= 1}
                    onClick={() => onBlockSizeChange && onBlockSizeChange(Math.max(1, blockSize - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-mono font-bold text-emerald-400 text-sm">
                    {blockSize}
                  </span>
                  <button
                    type="button"
                    disabled={blockSize >= 500}
                    onClick={() => onBlockSizeChange && onBlockSizeChange(blockSize + 1)}
                    className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={randomizeBlockSize}
                    onChange={(e) => onRandomizeBlockSizeChange && onRandomizeBlockSizeChange(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] font-medium">Randomize block jitter (±2)</span>
                </label>
              </div>
            </div>
          )}

          {/* Safety Toggles for Multi-Number Broadcasting */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={staggerVariations}
                onChange={(e) => onStaggerVariationsChange && onStaggerVariationsChange(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-bold text-slate-200 block text-[11px]">Stagger Variations</span>
                <span className="text-[10px] text-slate-400">Number A starts at M1, B at M2</span>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={failoverEnabled}
                onChange={(e) => onFailoverEnabledChange && onFailoverEnabledChange(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-bold text-slate-200 block text-[11px]">Failover Protection</span>
                <span className="text-[10px] text-slate-400">Auto-migrates if a number drops</span>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={stickyConversations}
                onChange={(e) => onStickyConversationsChange && onStickyConversationsChange(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-bold text-slate-200 block text-[11px]">Sticky Conversations</span>
                <span className="text-[10px] text-slate-400">Keep prior contacts on same number</span>
              </div>
            </label>
          </div>

          {/* Visual Assignment Matrix & Multi-Number Lanes Preview */}
          {twoLayerData && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Two-Layer Broadcast Assignment Matrix (Live Multi-Number Preview)</span>
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click any chip to preview that recipient's exact message and sender in the phone simulator.
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPreviewViewMode('lanes')}
                    className={`px-2.5 py-1 rounded transition font-medium ${
                      previewViewMode === 'lanes' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Lanes View
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewMode('matrix')}
                    className={`px-2.5 py-1 rounded transition font-medium ${
                      previewViewMode === 'matrix' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Matrix Table
                  </button>
                </div>
              </div>

              {/* View 1: Horizontal Multi-Number Lanes */}
              {previewViewMode === 'lanes' && (
                <div className="space-y-2.5">
                  {Object.entries(twoLayerData.lanes).map(([instId, items], instIdx) => {
                    const instObj = selectedInstances.find((i) => i.id === instId || i.name === instId);
                    const instName = instObj?.name || instId;
                    const colorPalette = [
                      { pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
                      { pill: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
                      { pill: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
                      { pill: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
                    ][instIdx % 4]!;

                    return (
                      <div key={instId} className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="font-bold text-white">{instName}</span>
                            <span className="text-[10px] text-slate-400">
                              ({items.length} contacts allocated • {Math.round((items.length / twoLayerData.allocations.length) * 100)}%)
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-400">Parallel Send Lane #{instIdx + 1}</span>
                        </div>

                        {/* Recipient Chips in Send Order */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                          {items.slice(0, 16).map((item) => {
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
                                className={`flex flex-col items-center justify-center min-w-[58px] py-1 px-1.5 rounded-lg border cursor-pointer transition hover:scale-105 shrink-0 ${badgeCol.bg} ${badgeCol.text} ${badgeCol.border}`}
                                title={`${instName} sending "${item.variantLabel}" to ${item.name || item.phone}`}
                              >
                                <span className="text-[9px] opacity-70 font-mono">R{item.allocationIndex + 1}</span>
                                <span className="font-bold text-[11px]">{item.variantLabel.slice(0, 8)}</span>
                              </button>
                            );
                          })}
                          {items.length > 16 && (
                            <span className="text-[10px] text-slate-500 font-mono pl-1 shrink-0">
                              +{items.length - 16} more...
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View 2: Matrix Table */}
              {previewViewMode === 'matrix' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">Recipient</th>
                        <th className="p-2.5">WhatsApp Number</th>
                        <th className="p-2.5">Assigned Variant</th>
                        <th className="p-2.5">Preview Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {twoLayerData.allocations.slice(matrixPage * MATRIX_PAGE_SIZE, (matrixPage + 1) * MATRIX_PAGE_SIZE).map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => {
                            const idx = (row.variantPosition || 1) - 1;
                            setEditingCardIndex(idx);
                            onActivePreviewVariantIndexChange(idx);
                          }}
                          className="hover:bg-slate-900/60 transition cursor-pointer"
                        >
                          <td className="p-2.5 font-mono text-emerald-400">
                            #{row.allocationIndex + 1} ({row.name || row.phone})
                          </td>
                          <td className="p-2.5 font-bold text-white">
                            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                              {row.instanceName}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                              {row.variantLabel}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400 truncate max-w-[200px]">
                            {row.renderedPreview || row.variantContent}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
                    <span>
                      Showing {matrixPage * MATRIX_PAGE_SIZE + 1}–{Math.min(twoLayerData.allocations.length, (matrixPage + 1) * MATRIX_PAGE_SIZE)} of {twoLayerData.allocations.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={matrixPage === 0}
                        onClick={() => setMatrixPage(Math.max(0, matrixPage - 1))}
                        className="px-2 py-0.5 rounded bg-slate-800 disabled:opacity-30 text-white"
                      >
                        ‹ Prev
                      </button>
                      <button
                        type="button"
                        disabled={(matrixPage + 1) * MATRIX_PAGE_SIZE >= twoLayerData.allocations.length}
                        onClick={() => setMatrixPage(matrixPage + 1)}
                        className="px-2 py-0.5 rounded bg-slate-800 disabled:opacity-30 text-white"
                      >
                        Next ›
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Distribution Summary & Parallel Speedup Projection */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">Parallel Send Lanes:</span>
                  <span className="text-emerald-400 font-bold">
                    {Math.round(totalRecipientsCount / selectedInstances.length)} msgs/number
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Estimated duration: ~{Math.ceil((totalRecipientsCount / selectedInstances.length) * 15 / 60)} mins (in parallel)
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-slate-500" />
            <span>
              Single WhatsApp Number Active: broadcasting sequentially. (Tip: select 2+ numbers in Step 1 to unlock parallel anti-ban load distribution).
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">1 Number</span>
        </div>
      )}

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

          {/* Media Attach & Upload */}
          {singleMediaType !== 'text' && (
            <MediaUploadInput
              mediaType={singleMediaType}
              mediaUrl={singleMediaUrl}
              fileName={singleFileName}
              onMediaUrlChange={onSingleMediaUrlChange}
              onFileNameChange={onSingleFileNameChange}
            />
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
                <span>Message Variants ({variants.length} of 20 max)</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateVariations}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow transition cursor-pointer"
                title="Keep base message and auto-generate 12 distinct variations with AI"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isGenerating ? 'Generating 12 Variations...' : 'Auto-Generate 12 Variations'}</span>
              </button>

              <button
                type="button"
                disabled={variants.length >= 20 || isGenerating}
                onClick={handleAddVariant}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  variants.length < 20
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
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Full Audience Continuous Rotation (All {totalRecipientsCount} Recipients)</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Rotation cycles continuously through all {totalRecipientsCount} contacts (M1 → M2 → ... → M{variants.length} → M1...) without stopping.
                </p>
              </div>

              {/* Sequence Pagination Window */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-[11px]">
                <button
                  type="button"
                  disabled={previewPage === 0}
                  onClick={() => setPreviewPage(Math.max(0, previewPage - 1))}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 font-semibold transition"
                >
                  ‹ Prev
                </button>
                <span className="font-mono text-emerald-400 text-[10px] px-1.5 font-bold">
                  Recipients {startRecipientIdx + 1}–{Math.min(totalRecipientsCount, startRecipientIdx + currentWindowSize)} of {totalRecipientsCount}
                </span>
                <button
                  type="button"
                  disabled={startRecipientIdx + PREVIEW_PAGE_SIZE >= totalRecipientsCount}
                  onClick={() => setPreviewPage(previewPage + 1)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 font-semibold transition"
                >
                  Next ›
                </button>
              </div>
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
                  <MediaUploadInput
                    mediaType={variants[editingCardIndex]!.mediaType || 'image'}
                    mediaUrl={variants[editingCardIndex]!.mediaUrl || ''}
                    fileName={variants[editingCardIndex]!.fileName || ''}
                    onMediaUrlChange={(url) => handleUpdateCard(editingCardIndex, { mediaUrl: url })}
                    onFileNameChange={(name) => handleUpdateCard(editingCardIndex, { fileName: name })}
                  />
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

