'use client';

import React, { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, NodeProps } from '@xyflow/react';
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
  AlertCircle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { FlowNodeData } from '@/lib/flow/schema';

function getNodeMeta(nodeType: string) {
  switch (nodeType) {
    case 'trigger_keyword':
      return { label: 'Keyword Trigger', color: 'from-amber-500 to-amber-700', icon: Zap, isTrigger: true };
    case 'trigger_first_message':
      return { label: 'First Message', color: 'from-amber-500 to-amber-700', icon: Zap, isTrigger: true };
    case 'trigger_campaign_reply':
      return { label: 'Campaign Reply', color: 'from-amber-500 to-amber-700', icon: Zap, isTrigger: true };
    case 'trigger_fallback':
      return { label: 'Any Message', color: 'from-amber-500 to-amber-700', icon: Zap, isTrigger: true };
    case 'message_text':
      return { label: 'Send Text', color: 'from-emerald-500 to-emerald-700', icon: MessageSquare };
    case 'message_media':
      return { label: 'Send Media', color: 'from-emerald-500 to-emerald-700', icon: MessageSquare };
    case 'message_menu':
      return { label: 'Numbered Menu', color: 'from-teal-500 to-teal-700', icon: Layers };
    case 'input_ask':
      return { label: 'Ask Question', color: 'from-sky-500 to-sky-700', icon: HelpCircle };
    case 'logic_condition':
      return { label: 'Condition (If/Else)', color: 'from-purple-500 to-purple-700', icon: GitBranch };
    case 'logic_business_hours':
      return { label: 'Business Hours', color: 'from-indigo-500 to-indigo-700', icon: Clock };
    case 'logic_wait':
      return { label: 'Wait / Delay', color: 'from-slate-600 to-slate-800', icon: Clock };
    case 'logic_set_variable':
      return { label: 'Set Variables', color: 'from-blue-500 to-blue-700', icon: GitBranch };
    case 'ai_reply':
      return { label: 'AI Reply (OpenRouter)', color: 'from-fuchsia-500 to-fuchsia-700', icon: Sparkles };
    case 'integration_http':
      return { label: 'HTTP Webhook', color: 'from-cyan-500 to-cyan-700', icon: Globe };
    case 'action_notify':
      return { label: 'Notify Team', color: 'from-yellow-500 to-yellow-700', icon: Bell };
    case 'action_save_lead':
      return { label: 'Save Lead', color: 'from-green-500 to-green-700', icon: UserCheck };
    case 'control_handoff':
      return { label: 'Human Handoff', color: 'from-rose-500 to-rose-700', icon: UserCheck };
    case 'control_opt_out':
      return { label: 'Opt-Out Contact', color: 'from-red-600 to-red-800', icon: UserX };
    case 'control_end':
      return { label: 'End Flow', color: 'from-slate-700 to-slate-900', icon: StopCircle, isEnd: true };
    case 'note':
      return { label: 'Sticky Note', color: 'from-yellow-400 to-yellow-600', icon: FileText, isNote: true };
    default:
      return { label: 'Bot Node', color: 'from-slate-600 to-slate-800', icon: MessageSquare };
  }
}

export const CustomNode = memo(function CustomNode({ id, data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData;
  const { nodeType, config } = nodeData;
  const meta = getNodeMeta(nodeType);
  const Icon = meta.icon;
  const updateNodeInternals = useUpdateNodeInternals();

  const isTrigger = meta.isTrigger;
  const isEnd = meta.isEnd || nodeType === 'control_end' || nodeType === 'control_opt_out' || nodeType === 'control_handoff';
  const hasErrors = nodeData.validationErrors && nodeData.validationErrors.length > 0;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, config, updateNodeInternals]);

  // Preview snippet text
  const previewSnippet =
    config?.text ||
    config?.questionText ||
    config?.menuTitle ||
    config?.noteText ||
    (config?.keywords ? `Keywords: ${config.keywords.slice(0, 3).join(', ')}` : '') ||
    config?.httpUrl ||
    'Configure node in properties panel';

  return (
    <div
      className={`min-w-[260px] max-w-[320px] rounded-2xl bg-slate-900 border transition-all shadow-xl font-sans text-xs ${
        selected
          ? 'border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-950/50'
          : hasErrors
          ? 'border-rose-500 ring-1 ring-rose-500/50 shadow-rose-950/30'
          : 'border-slate-800 hover:border-slate-700 shadow-slate-950/60'
      }`}
    >
      {/* Target Handle (Top) - except triggers */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          id="target"
          className="!w-3 !h-3 !bg-slate-700 !border-2 !border-emerald-400 hover:!bg-emerald-400 !transition"
        />
      )}

      {/* Node Header */}
      <div className={`p-3 rounded-t-2xl bg-gradient-to-r ${meta.color} flex items-center justify-between text-white shadow-sm`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 shrink-0 drop-shadow" />
          <span className="font-bold tracking-tight truncate max-w-[190px]">
            {nodeData.label || meta.label}
          </span>
        </div>
        {hasErrors && (
          <div title={nodeData.validationErrors?.join(', ')} className="shrink-0 bg-rose-950/80 p-0.5 rounded text-rose-300">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Node Body / Preview */}
      <div className="p-3 text-slate-300 space-y-2">
        <p className="line-clamp-2 text-[11px] text-slate-300 italic leading-relaxed break-words">
          "{previewSnippet}"
        </p>

        {/* Dynamic Branch Preview */}
        {nodeType === 'message_menu' && config?.menuOptions && config.menuOptions.length > 0 && (
          <div className="pt-2 border-t border-slate-800 space-y-1">
            {config.menuOptions.map((opt, idx) => (
              <div key={opt.id || idx} className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-950/40 px-2 py-0.5 rounded">
                <span className="truncate max-w-[200px]">
                  <strong className="text-emerald-400 mr-1">{opt.index || idx + 1}.</strong>
                  {opt.label}
                </span>
                <span className="text-[9px] text-slate-500 font-mono">Option {opt.index || idx + 1}</span>
              </div>
            ))}
          </div>
        )}

        {nodeType === 'logic_condition' && (
          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-emerald-400 font-bold">✓ True</span>
            <span className="text-rose-400 font-bold">✗ False</span>
          </div>
        )}

        {nodeType === 'logic_business_hours' && (
          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-emerald-400 font-bold">☀️ Open</span>
            <span className="text-amber-400 font-bold">🌙 Closed</span>
          </div>
        )}
      </div>

      {/* Custom Output Handles */}
      {/* 1. Menu Node: dynamic handles per option */}
      {nodeType === 'message_menu' && config?.menuOptions && config.menuOptions.length > 0 ? (
        <div className="relative pt-2 pb-1 border-t border-slate-800/80 bg-slate-950/40 rounded-b-2xl">
          <div className="flex items-center justify-around px-2 text-[9px] font-mono text-slate-400">
            {config.menuOptions.map((opt, idx) => {
              const handleId = opt.id || `opt_${idx + 1}`;
              return (
                <div key={handleId} className="flex flex-col items-center">
                  <span className="mb-1 text-emerald-400 font-bold">#{opt.index || idx + 1}</span>
                  <Handle
                    type="source"
                    position={Position.Bottom}
                    id={handleId}
                    style={{ left: `${((idx + 1) / (config.menuOptions!.length + 1)) * 100}%` }}
                    className="!w-3 !h-3 !bg-slate-700 !border-2 !border-emerald-400 hover:!bg-emerald-400"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : nodeType === 'logic_condition' ? (
        // 2. Condition Node: True / False handles
        <div className="relative h-4 bg-slate-950/60 rounded-b-2xl">
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{ left: '30%' }}
            className="!w-3 !h-3 !bg-slate-700 !border-2 !border-emerald-400 hover:!bg-emerald-400"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{ left: '70%' }}
            className="!w-3 !h-3 !bg-slate-700 !border-2 !border-rose-400 hover:!bg-rose-400"
          />
        </div>
      ) : nodeType === 'logic_business_hours' ? (
        // 3. Business Hours Node: Open / Closed handles
        <div className="relative h-4 bg-slate-950/60 rounded-b-2xl">
          <Handle
            type="source"
            position={Position.Bottom}
            id="open"
            style={{ left: '30%' }}
            className="!w-3 !h-3 !bg-slate-700 !border-2 !border-emerald-400 hover:!bg-emerald-400"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="closed"
            style={{ left: '70%' }}
            className="!w-3 !h-3 !bg-slate-700 !border-2 !border-amber-400 hover:!bg-amber-400"
          />
        </div>
      ) : !isEnd ? (
        // Standard single bottom output handle
        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className="!w-3 !h-3 !bg-slate-700 !border-2 !border-emerald-400 hover:!bg-emerald-400 !transition"
        />
      ) : null}
    </div>
  );
});
