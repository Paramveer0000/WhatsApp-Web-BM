'use client';

import React, { useEffect, useState } from 'react';
import { Stethoscope, X, ChevronUp, ChevronDown, CheckCircle, AlertTriangle, Bug } from 'lucide-react';

interface ClickEventRecord {
  id: string;
  time: string;
  target: string;
  role: string;
  hasHandler: boolean;
  type: string;
  status: 'ok' | 'dead' | 'error';
  details?: string;
}

export default function ClickDoctor() {
  const [enabled, setEnabled] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [clicks, setClicks] = useState<ClickEventRecord[]>([]);

  useEffect(() => {
    // Check if ?debug=1 in query or debug_mode in localStorage
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isDebug = params.get('debug') === '1' || localStorage.getItem('debug_mode') === 'true';
      if (isDebug) {
        setEnabled(true);
        console.log('%c[Click Doctor Active]%c Debug mode enabled via ?debug=1', 'background: #059669; color: white; padding: 2px 6px; border-radius: 4px;', 'color: #10b981;');
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleClickCapture = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;

      // Ignore clicks within the ClickDoctor UI itself
      if (el.closest('#click-doctor-hud')) return;

      const interactive = el.closest('button, a, input, select, textarea, [role=button], [role=tab], [role=menuitem]') as HTMLElement | null;
      const targetEl = interactive || el;

      const tag = targetEl.tagName.toLowerCase();
      const role = targetEl.getAttribute('role') || tag;
      const text = (targetEl.innerText || targetEl.getAttribute('aria-label') || targetEl.getAttribute('title') || targetEl.getAttribute('placeholder') || '').trim().slice(0, 30);
      const targetLabel = `<${tag}> ${text ? `"${text}"` : (targetEl.className ? `.${targetEl.className.split(' ')[0]}` : '')}`;

      const hasOnClick = Boolean((targetEl as any).onclick) || targetEl.getAttribute('onclick') !== null || tag === 'button' || tag === 'a';
      const isInsideForm = Boolean(targetEl.closest('form'));

      const recordId = `clk-${Date.now()}`;
      const record: ClickEventRecord = {
        id: recordId,
        time: new Date().toLocaleTimeString(),
        target: targetLabel,
        role,
        hasHandler: hasOnClick || isInsideForm,
        type: tag,
        status: (hasOnClick || isInsideForm) ? 'ok' : 'dead',
        details: isInsideForm ? 'Form trigger' : (hasOnClick ? 'Handler registered' : 'No apparent handler')
      };

      console.groupCollapsed(`%c[ClickDoctor]%c ${targetLabel}`, 'color: #3b82f6; font-weight: bold;', 'color: inherit;');
      console.log('Element:', targetEl);
      console.log('Role/Tag:', role);
      console.log('Inside Form:', isInsideForm);
      console.log('Has Handler:', hasOnClick);
      console.groupEnd();

      setClicks((prev) => [record, ...prev].slice(0, 25));
    };

    window.addEventListener('click', handleClickCapture, true);
    return () => {
      window.removeEventListener('click', handleClickCapture, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      id="click-doctor-hud"
      className="fixed bottom-4 left-4 z-[9998] font-mono text-xs shadow-2xl transition-all"
    >
      {minimized ? (
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 bg-slate-900 border border-emerald-500/50 text-emerald-400 px-3 py-2 rounded-xl shadow-xl hover:bg-slate-800 transition-all cursor-pointer"
          title="Click Doctor Debugger Active"
        >
          <Stethoscope className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-semibold">Click Doctor</span>
          <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px]">
            {clicks.length}
          </span>
        </button>
      ) : (
        <div className="w-80 sm:w-96 bg-slate-900/95 border border-slate-700 rounded-2xl p-3 backdrop-blur-md flex flex-col max-h-96 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Stethoscope className="w-4 h-4" />
              <span>Click Doctor (?debug=1)</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setClicks([])}
                className="text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 bg-slate-800 rounded"
              >
                Clear
              </button>
              <button
                onClick={() => setMinimized(true)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 my-2 space-y-1 pr-1">
            {clicks.length === 0 ? (
              <div className="text-slate-500 text-center py-6">
                Click any button or tab to inspect...
              </div>
            ) : (
              clicks.map((c) => (
                <div key={c.id} className="pt-1.5 pb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-slate-200 font-medium truncate">{c.target}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{c.time}</span>
                      <span>•</span>
                      <span className={c.hasHandler ? 'text-emerald-400' : 'text-amber-400'}>
                        {c.details}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      c.status === 'ok'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : c.status === 'dead'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {c.status.toUpperCase()}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="text-[10px] text-slate-400 text-center pt-1 border-t border-slate-800">
            Open DevTools Console for deep network & error details
          </div>
        </div>
      )}
    </div>
  );
}

