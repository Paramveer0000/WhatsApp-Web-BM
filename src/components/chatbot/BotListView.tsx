'use client';

import React, { useState } from 'react';
import {
  Bot,
  Plus,
  Play,
  Pause,
  Copy,
  Trash2,
  Download,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';

interface BotItem {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'live' | 'paused' | 'archived';
  nodeCount: number;
  assignedInstances: string[];
  latestVersion: number | null;
  todayConversations: number;
  completionRate: number;
  updatedAt: string;
}

interface BotListViewProps {
  bots: BotItem[];
  availableInstances: Array<{ id: string; name: string }>;
  onSelectBot: (botId: string) => void;
  onOpenTemplateGallery: () => void;
  onToggleStatus: (botId: string, currentStatus: string) => void;
  onDuplicateBot: (botId: string) => void;
  onDeleteBot: (botId: string) => void;
  onPauseAll: () => void;
  isPausingAll?: boolean;
}

export function BotListView({
  bots,
  availableInstances,
  onSelectBot,
  onOpenTemplateGallery,
  onToggleStatus,
  onDuplicateBot,
  onDeleteBot,
  onPauseAll,
  isPausingAll,
}: BotListViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBots = bots.filter(
    (b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const anyLive = bots.some((b) => b.status === 'live');

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Bot className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">Chatbot Studio</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              v1.0 Plug & Play
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Build, test, and publish conversational WhatsApp flows using drag-and-drop nodes. Connected to your instances and replies inbox.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Pause / Resume All Emergency Switch */}
          {bots.length > 0 && (
            <button
              onClick={onPauseAll}
              disabled={isPausingAll}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                anyLive
                  ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border-rose-500/30 shadow'
                  : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30 shadow'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{anyLive ? 'Pause All Bots' : 'Resume Live Bots'}</span>
            </button>
          )}

          {/* New Bot Button */}
          <button
            onClick={onOpenTemplateGallery}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>New Chatbot</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {bots.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center shadow-xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
            <Bot className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white">No WhatsApp Chatbots Created Yet</h3>
            <p className="text-xs text-slate-400 mt-1">
              Automate customer replies, lead capture, FAQs, and booking in 3 simple steps:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">1</span>
              <p className="font-bold text-white text-xs">Pick a Template</p>
              <p className="text-[11px] text-slate-400">Choose Lead Gen, FAQ Menu, or Appointment booking.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">2</span>
              <p className="font-bold text-white text-xs">Customize & Test</p>
              <p className="text-[11px] text-slate-400">Tweak text in visual editor and test in WhatsApp simulator.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">3</span>
              <p className="font-bold text-white text-xs">Assign & Turn ON</p>
              <p className="text-[11px] text-slate-400">Select your WhatsApp number and toggle bot to LIVE.</p>
            </div>
          </div>

          <button
            onClick={onOpenTemplateGallery}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Template Gallery</span>
          </button>
        </div>
      ) : (
        /* Bots Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBots.map((bot) => {
            const isLive = bot.status === 'live';
            const isPaused = bot.status === 'paused';

            return (
              <div
                key={bot.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl flex flex-col justify-between transition group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isLive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : isPaused
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {bot.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onToggleStatus(bot.id, bot.status)}
                        className={`p-1.5 rounded-lg transition ${
                          isLive
                            ? 'bg-amber-950/60 hover:bg-amber-900/60 text-amber-400'
                            : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400'
                        }`}
                        title={isLive ? 'Pause bot' : 'Activate bot'}
                      >
                        {isLive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onDuplicateBot(bot.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                        title="Duplicate bot"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteBot(bot.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                        title="Delete bot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3
                    onClick={() => onSelectBot(bot.id)}
                    className="font-bold text-white text-sm hover:text-emerald-400 transition cursor-pointer truncate"
                  >
                    {bot.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {bot.description || 'Visual conversational chatbot'}
                  </p>

                  {/* Metadata Chips */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg">
                      <Layers className="w-3 h-3 text-emerald-400" />
                      {bot.nodeCount} Nodes
                    </span>
                    <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg">
                      <Smartphone className="w-3 h-3 text-sky-400" />
                      {bot.assignedInstances.length > 0 ? `${bot.assignedInstances.length} Number(s)` : 'No Instance'}
                    </span>
                    {bot.latestVersion && (
                      <span className="bg-slate-950 px-2 py-0.5 rounded-lg text-slate-300">
                        v{bot.latestVersion}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    Updated {new Date(bot.updatedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => onSelectBot(bot.id)}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <span>Open Studio</span>
                    <ArrowRight className="w-3 h-3 text-emerald-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

