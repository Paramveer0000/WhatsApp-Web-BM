'use client';

import React, { useState } from 'react';
import {
  Trophy,
  AlertTriangle,
  Pause,
  Play,
  BookmarkPlus,
  BarChart3,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface VariantStat {
  id: string;
  position: number;
  label: string;
  content: string;
  isPaused: boolean;
  totalAssigned: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
  smallSampleWarning: boolean;
  isBestPerformer?: boolean;
}

interface CampaignVariantsLiveTabProps {
  campaignId: string;
  variantStats: VariantStat[];
  onTogglePause: (variantId: string, isPaused: boolean) => void;
  onSaveAsTemplate: (content: string, label: string) => void;
  onRefresh: () => void;
}

export default function CampaignVariantsLiveTab({
  campaignId,
  variantStats,
  onTogglePause,
  onSaveAsTemplate,
  onRefresh,
}: CampaignVariantsLiveTabProps) {
  const [selectedPreviewVariant, setSelectedPreviewVariant] = useState<VariantStat | null>(null);

  if (!variantStats || variantStats.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
        <p className="text-sm font-semibold text-slate-300">No multi-message variant data available</p>
        <p className="text-xs text-slate-500">
          This campaign was launched in single-template mode or message assignments are initializing.
        </p>
      </div>
    );
  }

  // Find winner
  const bestVariant = variantStats.find((v) => v.isBestPerformer);

  return (
    <div className="space-y-6">
      {/* Top Banner: Winning Message Summary */}
      {bestVariant && (
        <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/40 border border-emerald-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{bestVariant.label} is leading performance!</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                  {bestVariant.replyRate}% Reply Rate
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80 mt-0.5 truncate max-w-xl font-mono">
                "{bestVariant.content.slice(0, 100)}..."
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSaveAsTemplate(bestVariant.content, bestVariant.label)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer shrink-0"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Save Winner as Template</span>
          </button>
        </div>
      )}

      {/* Per-Variant Analytics Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Message Rotation Breakdown & Performance
            </h3>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Stats</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px]">
                <th className="py-2.5 px-4">Message</th>
                <th className="py-2.5 px-4 text-center">Assigned</th>
                <th className="py-2.5 px-4 text-center">Sent</th>
                <th className="py-2.5 px-4 text-center">Delivered</th>
                <th className="py-2.5 px-4 text-center">Read</th>
                <th className="py-2.5 px-4 text-center">Replied</th>
                <th className="py-2.5 px-4 text-center">Reply Rate</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {variantStats.map((v) => (
                <tr key={v.id} className="hover:bg-slate-850/50 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-emerald-400">
                        M{v.position}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-200">{v.label}</span>
                          {v.isBestPerformer && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              ⭐ Top Performer
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs">{v.content}</p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center font-mono text-slate-300">{v.totalAssigned}</td>
                  <td className="py-3 px-4 text-center font-mono text-slate-300">{v.sent}</td>
                  <td className="py-3 px-4 text-center font-mono text-emerald-400">{v.delivered}</td>
                  <td className="py-3 px-4 text-center font-mono text-teal-400">{v.read}</td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-sky-400">{v.replied}</td>

                  {/* Reply Rate & Progress */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono font-bold text-slate-200">{v.replyRate}%</span>
                      <div className="w-16 bg-slate-950 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, v.replyRate * 5)}%` }}
                        />
                      </div>
                      {v.smallSampleWarning && (
                        <span className="text-[9px] text-amber-400 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>&lt;100 sends</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        v.isPaused
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      {v.isPaused ? 'Paused' : 'Active'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewVariant(v)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                        title="View Full Content"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onTogglePause(v.id, v.isPaused)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          v.isPaused
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                            : 'bg-slate-800 hover:bg-amber-900/40 text-amber-400 border border-amber-500/30'
                        }`}
                        title={
                          v.isPaused
                            ? 'Resume this message'
                            : 'Pause this message (redistributes remaining recipients)'
                        }
                      >
                        {v.isPaused ? (
                          <>
                            <Play className="w-3 h-3" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message Preview Modal */}
      {selectedPreviewVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-sm text-white">
                Message {selectedPreviewVariant.position}: {selectedPreviewVariant.label}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPreviewVariant(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ Close
              </button>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
              {selectedPreviewVariant.content}
            </div>
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  onSaveAsTemplate(selectedPreviewVariant.content, selectedPreviewVariant.label);
                  setSelectedPreviewVariant(null);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow"
              >
                Save as Template
              </button>
              <button
                type="button"
                onClick={() => setSelectedPreviewVariant(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

