'use client';

import React from 'react';
import { FlowNode } from '@/lib/flow/schema';
import {
  Trash2,
  HelpCircle,
  Plus,
  X,
  MessageSquare,
  Sparkles,
  Layers,
  Clock,
  Globe,
  Settings2,
} from 'lucide-react';

interface PropertiesPanelProps {
  selectedNode: FlowNode | null;
  onUpdateNode: (nodeId: string, updatedData: Partial<FlowNode['data']>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
}

export function PropertiesPanel({
  selectedNode,
  onUpdateNode,
  onDeleteNode,
  onClose,
}: PropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <div className="w-80 h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
        <Settings2 className="w-8 h-8 text-slate-700 mb-2" />
        <p className="font-semibold text-slate-400">No Node Selected</p>
        <p className="text-[11px] mt-1 text-slate-500">
          Click any node on the canvas to configure its messages, conditions, variables, and branches.
        </p>
      </div>
    );
  }

  const { id, data } = selectedNode;
  const { nodeType, config } = data;

  const updateConfig = (key: string, value: any) => {
    onUpdateNode(id, {
      config: {
        ...config,
        [key]: value,
      },
    });
  };

  const updateLabel = (label: string) => {
    onUpdateNode(id, { label });
  };

  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col text-xs select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div>
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">Node Inspector</span>
          <p className="text-[10px] text-slate-400 font-mono">ID: {id}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDeleteNode(id)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 transition"
            title="Delete this node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node Name */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 block mb-1">Node Title</label>
          <input
            type="text"
            value={data.label || ''}
            onChange={(e) => updateLabel(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* 1. TRIGGER KEYWORD */}
        {nodeType === 'trigger_keyword' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Keywords (Comma Separated)
              </label>
              <textarea
                rows={2}
                value={(config.keywords || []).join(', ')}
                onChange={(e) =>
                  updateConfig(
                    'keywords',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                  )
                }
                placeholder="hi, hello, menu, start, pricing"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Match Mode</label>
              <select
                value={config.matchMode || 'contains'}
                onChange={(e) => updateConfig('matchMode', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="contains">Contains (e.g. "hi there" matches "hi")</option>
                <option value="exact">Exact Match</option>
                <option value="starts_with">Starts With</option>
                <option value="regex">Regular Expression</option>
              </select>
            </div>
          </div>
        )}

        {/* 2. SEND TEXT MESSAGE */}
        {nodeType === 'message_text' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-400">Message Text</label>
                <span className="text-[10px] text-slate-500 font-mono">Spintax & variables OK</span>
              </div>
              <textarea
                rows={5}
                value={config.text || ''}
                onChange={(e) => updateConfig('text', e.target.value)}
                placeholder="{Hi|Hello} {{contact.name|there}}! How can we help you?"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="typingSimulation"
                checked={config.typingSimulation !== false}
                onChange={(e) => updateConfig('typingSimulation', e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="typingSimulation" className="text-slate-300 text-xs">
                Simulate human typing delay
              </label>
            </div>

            {/* Live WhatsApp Bubble Preview */}
            <div className="p-3 rounded-2xl bg-[#0b141a] border border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">WhatsApp Preview</span>
              <div className="bg-[#005c4b] text-white rounded-2xl rounded-tr-none px-3.5 py-2 shadow text-[11px] leading-relaxed break-words whitespace-pre-wrap">
                {config.text || 'Message text preview...'}
                <span className="block text-right text-[9px] text-emerald-200 mt-1 font-mono">10:45 AM ✓✓</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. NUMBERED MENU */}
        {nodeType === 'message_menu' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Menu Title</label>
              <input
                type="text"
                value={config.menuTitle || ''}
                onChange={(e) => updateConfig('menuTitle', e.target.value)}
                placeholder="Please choose an option:"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Menu Options</label>
              <div className="space-y-2">
                {(config.menuOptions || []).map((opt, idx) => (
                  <div key={opt.id || idx} className="flex items-center gap-2">
                    <span className="font-bold text-emerald-400 font-mono w-4">{idx + 1}.</span>
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => {
                        const nextOpts = [...(config.menuOptions || [])];
                        nextOpts[idx] = { ...opt, label: e.target.value };
                        updateConfig('menuOptions', nextOpts);
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => {
                        const nextOpts = (config.menuOptions || []).filter((_, i) => i !== idx);
                        updateConfig('menuOptions', nextOpts);
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const nextOpts = [...(config.menuOptions || [])];
                    const nextNum = nextOpts.length + 1;
                    nextOpts.push({
                      id: `opt_${Date.now()}`,
                      index: nextNum,
                      label: `Option ${nextNum}`,
                      keywords: [],
                    });
                    updateConfig('menuOptions', nextOpts);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition cursor-pointer w-full justify-center"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Add Option</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Invalid Reply Message</label>
              <input
                type="text"
                value={config.invalidReplyText || ''}
                onChange={(e) => updateConfig('invalidReplyText', e.target.value)}
                placeholder="Please reply with a valid option number."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* 4. ASK QUESTION */}
        {nodeType === 'input_ask' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Question Prompt</label>
              <textarea
                rows={3}
                value={config.questionText || ''}
                onChange={(e) => updateConfig('questionText', e.target.value)}
                placeholder="What is your email address?"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Store in Variable</label>
              <input
                type="text"
                value={config.variableName || ''}
                onChange={(e) => updateConfig('variableName', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="customer_email"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-emerald-400 font-mono font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Validation Type</label>
              <select
                value={config.validationType || 'text'}
                onChange={(e) => updateConfig('validationType', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="text">Any Text</option>
                <option value="number">Number</option>
                <option value="email">Email Address</option>
                <option value="phone">Phone Number</option>
                <option value="date">Date</option>
                <option value="choice">Choice list</option>
                <option value="regex">Regular Expression</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Retry Error Message</label>
              <input
                type="text"
                value={config.retryMessage || ''}
                onChange={(e) => updateConfig('retryMessage', e.target.value)}
                placeholder="Please enter a valid format."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}

        {/* 5. CONDITION (IF / ELSE) */}
        {nodeType === 'logic_condition' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Condition Rule</label>
              {((config.conditionRules && config.conditionRules.length > 0) ? config.conditionRules : [{ variable: 'last_menu_choice', operator: 'equals', value: '' }]).map((rule, idx) => (
                <div key={idx} className="space-y-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <input
                    type="text"
                    value={rule.variable}
                    onChange={(e) => {
                      const rules = [...(config.conditionRules || [{ variable: '', operator: 'equals', value: '' }])];
                      rules[idx].variable = e.target.value;
                      updateConfig('conditionRules', rules);
                    }}
                    placeholder="Variable name"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono"
                  />
                  <select
                    value={rule.operator}
                    onChange={(e) => {
                      const rules = [...(config.conditionRules || [{ variable: '', operator: 'equals', value: '' }])];
                      rules[idx].operator = e.target.value as any;
                      updateConfig('conditionRules', rules);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs"
                  >
                    <option value="equals">Equals</option>
                    <option value="not_equals">Does Not Equal</option>
                    <option value="contains">Contains</option>
                    <option value="starts_with">Starts With</option>
                    <option value="greater_than">Greater Than (&gt;)</option>
                    <option value="less_than">Less Than (&lt;)</option>
                    <option value="is_empty">Is Empty</option>
                    <option value="is_not_empty">Is Not Empty</option>
                  </select>
                  <input
                    type="text"
                    value={rule.value}
                    onChange={(e) => {
                      const rules = [...(config.conditionRules || [{ variable: '', operator: 'equals', value: '' }])];
                      rules[idx].value = e.target.value;
                      updateConfig('conditionRules', rules);
                    }}
                    placeholder="Target value"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. BUSINESS HOURS */}
        {nodeType === 'logic_business_hours' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Timezone</label>
              <input
                type="text"
                value={config.timezone || 'Asia/Kolkata'}
                onChange={(e) => updateConfig('timezone', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Open Time</label>
                <input
                  type="time"
                  value={config.openTime || '09:30'}
                  onChange={(e) => updateConfig('openTime', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Close Time</label>
                <input
                  type="time"
                  value={config.closeTime || '18:30'}
                  onChange={(e) => updateConfig('closeTime', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* 7. AI REPLY (OPENROUTER) */}
        {nodeType === 'ai_reply' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">System Instructions</label>
              <textarea
                rows={4}
                value={config.systemPrompt || ''}
                onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                placeholder="You are a helpful customer assistant. Answer concisely and politely based on the knowledge provided."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Knowledge Base Text / FAQs</label>
              <textarea
                rows={4}
                value={config.knowledgeBaseText || ''}
                onChange={(e) => updateConfig('knowledgeBaseText', e.target.value)}
                placeholder="Paste your FAQ answers, business policies, pricing tiers here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        )}

        {/* 8. HUMAN HANDOFF */}
        {nodeType === 'control_handoff' && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Handoff Message</label>
              <textarea
                rows={3}
                value={config.handoffMessage || ''}
                onChange={(e) => updateConfig('handoffMessage', e.target.value)}
                placeholder="An agent is joining the chat to assist you..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
