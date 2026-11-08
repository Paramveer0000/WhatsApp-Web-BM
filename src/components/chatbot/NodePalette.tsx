'use client';

import React, { useState } from 'react';
import {
  Zap,
  MessageSquare,
  HelpCircle,
  GitBranch,
  Clock,
  Sparkles,
  Globe,
  Bell,
  UserCheck,
  UserX,
  StopCircle,
  FileText,
  Search,
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { FlowNodeTypeKey } from '@/lib/flow/schema';

interface PaletteItem {
  type: FlowNodeTypeKey;
  label: string;
  description: string;
  icon: any;
  color: string;
}

const PALETTE_GROUPS: Array<{
  name: string;
  items: PaletteItem[];
}> = [
  {
    name: 'Triggers',
    items: [
      { type: 'trigger_keyword', label: 'Keyword Trigger', description: 'Starts on keyword match', icon: Zap, color: 'text-amber-400' },
      { type: 'trigger_first_message', label: 'First Message', description: 'New contact first message', icon: Zap, color: 'text-amber-400' },
      { type: 'trigger_campaign_reply', label: 'Campaign Reply', description: 'Replies to broadcast campaign', icon: Zap, color: 'text-amber-400' },
      { type: 'trigger_fallback', label: 'Any Message', description: 'Catch-all default trigger', icon: Zap, color: 'text-amber-400' },
    ],
  },
  {
    name: 'Messages',
    items: [
      { type: 'message_text', label: 'Send Text', description: 'WhatsApp text with spintax', icon: MessageSquare, color: 'text-emerald-400' },
      { type: 'message_media', label: 'Send Media', description: 'Image, audio, or document', icon: MessageSquare, color: 'text-emerald-400' },
      { type: 'message_menu', label: 'Numbered Menu', description: 'Numbered options (1, 2, 3)', icon: Layers, color: 'text-teal-400' },
    ],
  },
  {
    name: 'Input & Logic',
    items: [
      { type: 'input_ask', label: 'Ask Question', description: 'Capture name, email, phone', icon: HelpCircle, color: 'text-sky-400' },
      { type: 'logic_condition', label: 'Condition (If/Else)', description: 'Branch based on variables', icon: GitBranch, color: 'text-purple-400' },
      { type: 'logic_business_hours', label: 'Business Hours', description: 'Check open / closed schedule', icon: Clock, color: 'text-indigo-400' },
      { type: 'logic_wait', label: 'Wait / Delay', description: 'Wait seconds before next step', icon: Clock, color: 'text-slate-400' },
      { type: 'logic_set_variable', label: 'Set Variables', description: 'Assign tags or variables', icon: GitBranch, color: 'text-blue-400' },
    ],
  },
  {
    name: 'AI & Integrations',
    items: [
      { type: 'ai_reply', label: 'AI Reply (OpenRouter)', description: 'GPT/Claude knowledge reply', icon: Sparkles, color: 'text-fuchsia-400' },
      { type: 'integration_http', label: 'HTTP Webhook', description: 'Call external CRM or API', icon: Globe, color: 'text-cyan-400' },
      { type: 'action_notify', label: 'Notify Team', description: 'In-app or webhook alert', icon: Bell, color: 'text-yellow-400' },
      { type: 'action_save_lead', label: 'Save Lead', description: 'Save to contact list & tags', icon: UserCheck, color: 'text-green-400' },
    ],
  },
  {
    name: 'Control & Flow',
    items: [
      { type: 'control_handoff', label: 'Human Handoff', description: 'Pause bot & notify agent', icon: UserCheck, color: 'text-rose-400' },
      { type: 'control_opt_out', label: 'Opt-out Contact', description: 'Add to blacklist & end', icon: UserX, color: 'text-red-400' },
      { type: 'control_end', label: 'End Flow', description: 'Terminate conversation', icon: StopCircle, color: 'text-slate-400' },
      { type: 'note', label: 'Sticky Note', description: 'Add comment on canvas', icon: FileText, color: 'text-yellow-300' },
    ],
  },
];

interface NodePaletteProps {
  onAddNode: (type: FlowNodeTypeKey) => void;
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (name: string) => {
    setCollapsed((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const onDragStart = (event: React.DragEvent, nodeType: FlowNodeTypeKey) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredGroups = PALETTE_GROUPS.map((group) => {
    const matchedItems = group.items.filter(
      (item) =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
    );
    return { ...group, items: matchedItems };
  }).filter((group) => group.items.length > 0);

  return (
    <div className="w-64 h-full bg-slate-900 border-r border-slate-800 flex flex-col select-none text-xs">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">Node Library</span>
          <span className="text-[10px] text-slate-500 font-mono">Drag or click</span>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 placeholder-slate-500"
          />
        </div>
      </div>

      {/* Palette Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {filteredGroups.map((group) => {
          const isCollapsed = collapsed[group.name];
          return (
            <div key={group.name} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.name)}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-white uppercase tracking-wider rounded transition"
              >
                <span>{group.name}</span>
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {!isCollapsed && (
                <div className="space-y-1 pl-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, item.type)}
                        onClick={() => onAddNode(item.type)}
                        className="group flex items-start gap-2.5 p-2 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-850 hover:border-slate-700 transition cursor-grab active:cursor-grabbing shadow-sm"
                        title="Click to add or drag onto canvas"
                      >
                        <div className={`p-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0 ${item.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate flex-1">
                          <p className="font-semibold text-white group-hover:text-emerald-400 transition truncate">
                            {item.label}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            {item.description}
                          </p>
                        </div>
                        <Plus className="w-3 h-3 text-slate-600 group-hover:text-emerald-400 shrink-0 opacity-0 group-hover:opacity-100 transition mt-1" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

