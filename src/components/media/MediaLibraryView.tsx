'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Search,
  Filter,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Trash2,
  Copy,
  ExternalLink,
  Check,
  RefreshCw,
  FolderOpen,
  HardDrive,
  X,
  File,
  Sparkles,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface MediaAsset {
  id: string;
  sha256: string;
  mime: string;
  size: number;
  path: string;
  url: string;
  title: string;
  fileName: string;
  category: string;
  tags: string[];
  createdAt: string;
}

interface MediaLibraryViewProps {
  onSelectAsset?: (asset: MediaAsset) => void;
  isPickerMode?: boolean;
}

export function MediaLibraryView({ onSelectAsset, isPickerMode = false }: MediaLibraryViewProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalStorage, setTotalStorage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<MediaAsset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/media/library?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch media assets');
      const data = await res.json();

      if (data.success) {
        setAssets(data.assets || []);
        setTotalStorage(data.totalStorageBytes || 0);
        setTotalCount(data.totalAssetsCount || 0);
      }
    } catch (err: any) {
      toast.error('Failed to load media assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [categoryFilter, searchQuery]);

  const handleUploadFile = async (file: File) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      toast.success(`Uploaded "${file.name}" successfully!`);
      setShowUploadModal(false);
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!assetToDelete) return;
    try {
      const res = await fetch(`/api/media/library?id=${assetToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete asset');

      toast.success('Media asset removed');
      setAssetToDelete(null);
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Could not delete media');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Direct URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-emerald-400" />;
      case 'video':
        return <Video className="w-5 h-5 text-blue-400" />;
      case 'audio':
        return <Music className="w-5 h-5 text-amber-400" />;
      default:
        return <FileText className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 dark:bg-slate-900/90 day:bg-white border border-slate-800 day:border-slate-200 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0c57e4] to-blue-700 flex items-center justify-center text-white shadow-md shadow-blue-950/40">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white day:text-slate-900 tracking-tight">
                Media Library DAM
              </h2>
              <p className="text-xs text-slate-400 day:text-slate-500">
                Centralized cloud asset management for WhatsApp broadcasts & chatbot responses
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 day:bg-slate-100 border border-slate-700/60 day:border-slate-200 text-xs">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400 day:text-slate-500">Storage Used:</span>
            <span className="font-semibold text-white day:text-slate-800">
              {formatFileSize(totalStorage)} ({totalCount} files)
            </span>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0c57e4] hover:bg-[#0944b5] text-white text-xs font-semibold shadow-lg shadow-emerald-950/30 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/70 day:bg-white border border-slate-800 day:border-slate-200 p-3 rounded-xl">
        {/* Category Pills (Zolo Suit Style) */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Files', icon: FolderOpen },
            { id: 'image', label: 'Images', icon: ImageIcon },
            { id: 'video', label: 'Videos', icon: Video },
            { id: 'document', label: 'Documents', icon: FileText },
            { id: 'audio', label: 'Audio', icon: Music },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0 ${
                  active
                    ? 'bg-[#0c57e4] text-white font-semibold shadow-sm'
                    : 'text-slate-400 day:text-slate-600 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search assets by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 day:bg-slate-50 border border-slate-700/80 day:border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white day:text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
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

      {/* Asset Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
          <p className="text-xs">Loading media assets...</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center p-8 bg-slate-900/50 day:bg-slate-50 border border-slate-800 day:border-slate-200 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 day:bg-slate-200 flex items-center justify-center text-slate-400 day:text-slate-500 mb-3">
            <ImageIcon className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-semibold text-white day:text-slate-900">No media assets found</h3>
          <p className="text-xs text-slate-400 day:text-slate-500 max-w-sm mt-1 mb-4">
            {searchQuery
              ? 'No files matched your search keyword. Try a different query.'
              : 'Upload promotional flyers, PDFs, brochures, or audio clips to easily attach to your broadcasts.'}
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0c57e4] hover:bg-[#0944b5] text-white text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Your First File</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {assets.map((asset) => {
            const isImage = asset.mime.startsWith('image/');
            const isVideo = asset.mime.startsWith('video/');

            return (
              <div
                key={asset.id}
                className="group relative bg-slate-900/80 day:bg-white border border-slate-800 day:border-slate-200 rounded-xl overflow-hidden shadow hover:border-emerald-500/50 day:hover:border-emerald-500/50 transition-all flex flex-col"
              >
                {/* Media Preview Box */}
                <div
                  className="aspect-square w-full bg-slate-950 day:bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer relative"
                  onClick={() => {
                    if (isPickerMode && onSelectAsset) {
                      onSelectAsset(asset);
                    } else {
                      setPreviewAsset(asset);
                    }
                  }}
                >
                  {isImage ? (
                    <img
                      src={asset.url}
                      alt={asset.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : isVideo ? (
                    <div className="flex flex-col items-center justify-center text-blue-400 gap-1.5 p-3">
                      <Video className="w-8 h-8" />
                      <span className="text-[10px] font-mono text-slate-400">Video</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-purple-400 gap-1.5 p-3">
                      {getCategoryIcon(asset.category)}
                      <span className="text-[10px] font-mono text-slate-400 uppercase">
                        {asset.fileName.split('.').pop() || 'FILE'}
                      </span>
                    </div>
                  )}

                  {/* Picker mode select button */}
                  {isPickerMode && (
                    <div className="absolute inset-0 bg-emerald-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                      <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg shadow">
                        Select Asset
                      </span>
                    </div>
                  )}
                </div>

                {/* Info & Action Footer */}
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4
                      className="text-xs font-medium text-white day:text-slate-900 truncate"
                      title={asset.title}
                    >
                      {asset.title}
                    </h4>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 day:text-slate-500 mt-1">
                      <span>{formatFileSize(asset.size)}</span>
                      <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-slate-800/80 day:border-slate-100">
                    <button
                      onClick={() => copyToClipboard(window.location.origin + asset.url, asset.id)}
                      className="p-1 rounded text-slate-400 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100 transition"
                      title="Copy direct URL"
                    >
                      {copiedId === asset.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded text-slate-400 hover:text-white day:hover:text-slate-900 hover:bg-slate-800 day:hover:bg-slate-100 transition"
                      title="Open full size"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => setAssetToDelete(asset)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 day:hover:bg-slate-100 transition"
                      title="Delete asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal (Dropzone) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 day:border-slate-200">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm text-white day:text-slate-900">
                  Upload Media Asset to DAM
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white day:hover:text-slate-800 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleUploadFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`my-6 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-700 day:border-slate-300 hover:border-emerald-500/50 bg-slate-800/30 day:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadFile(e.target.files[0]);
                  }
                }}
              />

              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-semibold text-white day:text-slate-800">
                {uploading ? 'Uploading media...' : 'Click to browse or drag & drop file'}
              </h4>
              <p className="text-[11px] text-slate-400 day:text-slate-500 mt-1 max-w-xs">
                Supports JPG, PNG, WEBP, GIF, MP4, MP3, PDF, and Documents up to 50MB
              </p>

              {uploading && (
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing & storing in DAM...</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white day:hover:text-slate-800 hover:bg-slate-800 day:hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-sm text-white day:text-slate-900">Delete Asset?</h3>
            <p className="text-xs text-slate-400 day:text-slate-600 mt-2">
              Are you sure you want to delete <span className="text-white font-semibold">{assetToDelete.title}</span>? This action removes the file from the server.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setAssetToDelete(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:bg-slate-800 day:hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-1.5 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 day:bg-white border border-slate-800 day:border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 day:border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white day:text-slate-900 truncate">
                  {previewAsset.title}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {formatFileSize(previewAsset.size)} • {previewAsset.mime}
                </p>
              </div>
              <button
                onClick={() => setPreviewAsset(null)}
                className="p-1 text-slate-400 hover:text-white day:hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex items-center justify-center max-h-[70vh] overflow-auto bg-slate-950">
              {previewAsset.mime.startsWith('image/') ? (
                <img
                  src={previewAsset.url}
                  alt={previewAsset.title}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg"
                />
              ) : previewAsset.mime.startsWith('video/') ? (
                <video
                  src={previewAsset.url}
                  controls
                  className="max-h-[60vh] max-w-full rounded-lg"
                />
              ) : previewAsset.mime.startsWith('audio/') ? (
                <audio src={previewAsset.url} controls className="w-full my-6" />
              ) : (
                <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                  <FileText className="w-16 h-16 text-purple-400" />
                  <p className="text-xs">Document file preview</p>
                  <a
                    href={previewAsset.url}
                    download={previewAsset.fileName}
                    className="px-4 py-2 bg-[#0c57e4] text-white rounded-xl text-xs font-semibold"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-900/50 day:bg-slate-50 border-t border-slate-800 day:border-slate-200 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-md">
                {previewAsset.url}
              </span>
              <button
                onClick={() => copyToClipboard(window.location.origin + previewAsset.url, previewAsset.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 day:bg-slate-200 hover:bg-slate-700 text-white day:text-slate-800 rounded-lg text-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

