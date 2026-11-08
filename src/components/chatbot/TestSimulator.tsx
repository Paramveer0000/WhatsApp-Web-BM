'use client';

import React, { useState } from 'react';
import {
  Send,
  RotateCcw,
  Sparkles,
  Terminal,
  X,
  Play,
  Bug,
  Database,
  ArrowRight,
} from 'lucide-react';
import { FlowDefinition, EngineSession } from '@/lib/flow/schema';
import { step, StepResult } from '@/lib/flow/engine';

interface TestSimulatorProps {
  flow: FlowDefinition;
  onHighlightNode?: (nodeId: string | null) => void;
  onClose: () => void;
}

export function TestSimulator({ flow, onHighlightNode, onClose }: TestSimulatorProps) {
  const [session, setSession] = useState<EngineSession>({
    id: `sim_${Date.now()}`,
    flowId: 'test_flow',
    instanceId: 'simulator',
    phone: '919876543210',
    status: 'active',
    currentNodeId: null,
    vars: { name: 'Customer' },
    stepSeq: 0,
    retryCount: 0,
    startedAt: new Date().toISOString(),
    lastInboundAt: new Date().toISOString(),
  });

  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; time: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [traceLogs, setTraceLogs] = useState<StepResult['logs']>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'trace' | 'vars'>('chat');
  const [isTyping, setIsTyping] = useState(false);

  // Restart simulator
  const handleRestart = () => {
    const initialSession: EngineSession = {
      id: `sim_${Date.now()}`,
      flowId: 'test_flow',
      instanceId: 'simulator',
      phone: '919876543210',
      status: 'active',
      currentNodeId: null,
      vars: { name: 'Customer' },
      stepSeq: 0,
      retryCount: 0,
      startedAt: new Date().toISOString(),
      lastInboundAt: new Date().toISOString(),
    };
    setSession(initialSession);
    setMessages([]);
    setTraceLogs([]);
    onHighlightNode?.(null);

    // Run initial trigger step (empty inbound to start)
    runSimulatorStep(initialSession, '');
  };

  const runSimulatorStep = (currentSession: EngineSession, userText: string) => {
    const inbound = userText
      ? {
          messageId: `msg_${Date.now()}`,
          instanceId: 'simulator',
          phone: currentSession.phone,
          text: userText,
          timestamp: Date.now(),
        }
      : undefined;

    const result = step(currentSession, flow, inbound);

    setSession(result.session);
    setTraceLogs((prev) => [...prev, ...result.logs]);

    if (result.session.currentNodeId) {
      onHighlightNode?.(result.session.currentNodeId);
    }

    if (result.actions.length > 0) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const botMessages = result.actions
          .filter((a) => a.type === 'send_text' || a.type === 'handoff')
          .map((a) => ({
            sender: 'bot' as const,
            text: (a as any).text || (a as any).message || '[Bot Action]',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));

        setMessages((prev) => [...prev, ...botMessages]);
      }, 400);
    }
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;

    const newMsg = {
      sender: 'user' as const,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    runSimulatorStep(session, text);
  };

  return (
    <div className="w-96 h-full bg-[#0b141a] border-l border-slate-800 flex flex-col text-xs shadow-2xl">
      {/* Simulator Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">Test Simulator</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRestart}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-[10px]"
            title="Restart session"
          >
            <RotateCcw className="w-3 h-3 text-emerald-400" />
            <span>Restart</span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs (Chat / Trace / Variables) */}
      <div className="flex border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 text-center transition ${
            activeTab === 'chat' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          WhatsApp Chat
        </button>
        <button
          onClick={() => setActiveTab('trace')}
          className={`flex-1 py-2 text-center transition ${
            activeTab === 'trace' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          Execution Trace ({traceLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('vars')}
          className={`flex-1 py-2 text-center transition ${
            activeTab === 'vars' ? 'border-b-2 border-emerald-400 text-emerald-400' : 'text-slate-400 hover:text-white'
          }`}
        >
          Variables ({Object.keys(session.vars).length})
        </button>
      </div>

      {/* TAB 1: WHATSAPP CHAT */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
                <Play className="w-6 h-6 text-emerald-500 mb-2" />
                <p className="font-semibold text-slate-400">Simulator Ready</p>
                <p className="text-[10px] mt-1">Type an entry keyword (e.g. "hi" or "menu") below to start test conversation.</p>
              </div>
            ) : (
              messages.map((m, i) => {
                const isUser = m.sender === 'user';
                return (
                  <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow leading-relaxed whitespace-pre-wrap break-words ${
                        isUser ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-slate-200 rounded-tl-none'
                      }`}
                    >
                      <p>{m.text}</p>
                      <span className="block text-right text-[9px] text-slate-400 mt-1 font-mono">
                        {m.time} {isUser ? '✓✓' : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-[#202c33] text-slate-400 rounded-2xl rounded-tl-none px-3 py-1.5 text-[10px] flex items-center gap-1">
                  <span className="animate-pulse">Bot is typing...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type message as customer..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim()}
              className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: EXECUTION TRACE */}
      {activeTab === 'trace' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {traceLogs.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No steps executed yet.</p>
          ) : (
            traceLogs.map((log, idx) => (
              <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-bold text-emerald-400 font-mono">Step #{idx + 1}</span>
                  <span className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 font-mono">{log.nodeType}</span>
                </div>
                <p className="text-slate-200 text-xs font-mono">{log.summary}</p>
                {log.vars && (
                  <pre className="text-[9px] text-slate-400 bg-slate-900 p-1.5 rounded overflow-x-auto">
                    {JSON.stringify(log.vars, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: VARIABLES INSPECTOR */}
      {activeTab === 'vars' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {Object.keys(session.vars).length === 0 ? (
            <p className="text-slate-500 text-center py-8">No variables stored in session yet.</p>
          ) : (
            Object.entries(session.vars).map(([key, value]) => (
              <div key={key} className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="font-mono text-emerald-400 font-bold text-xs">{`{{${key}}}`}</span>
                <span className="font-mono text-slate-200 text-xs truncate max-w-[150px]">
                  {String(value)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

