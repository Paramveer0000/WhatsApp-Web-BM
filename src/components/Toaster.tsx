'use client';

import React, { useEffect, useState } from 'react';
import { toast, ToastItem } from '@/lib/toast';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isDayTheme, setIsDayTheme] = useState(false);

  useEffect(() => {
    const unsubscribe = toast.subscribe((items) => {
      setToasts(items);
    });
    const checkTheme = () => {
      if (typeof document !== 'undefined') {
        const dt = document.documentElement.getAttribute('data-theme');
        setIsDayTheme(dt === 'day' || document.documentElement.classList.contains('day'));
      }
    };
    checkTheme();
    const obs = new MutationObserver(checkTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    return () => {
      unsubscribe();
      obs.disconnect();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';

        const borderClass = isDayTheme
          ? isSuccess
            ? 'border-emerald-300 bg-white/95 text-emerald-800 shadow-xl shadow-emerald-500/10'
            : isError
            ? 'border-rose-300 bg-white/95 text-rose-800 shadow-xl shadow-rose-500/10'
            : isWarning
            ? 'border-amber-300 bg-white/95 text-amber-800 shadow-xl shadow-amber-500/10'
            : 'border-blue-300 bg-white/95 text-blue-900 shadow-xl shadow-blue-500/10'
          : isSuccess
          ? 'border-emerald-500/40 bg-slate-900/95 text-emerald-300'
          : isError
          ? 'border-rose-500/50 bg-slate-900/95 text-rose-300'
          : isWarning
          ? 'border-amber-500/40 bg-slate-900/95 text-amber-300'
          : 'border-cyan-500/40 bg-slate-900/95 text-cyan-300';

        const icon = isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        ) : isError ? (
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        ) : isWarning ? (
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        ) : (
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        );

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 ${borderClass}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              {t.title && (
                <div className={`font-semibold text-sm mb-0.5 ${isDayTheme ? 'text-slate-900 font-bold' : 'text-slate-100'}`}>
                  {t.title}
                </div>
              )}
              <div className={`text-xs break-words leading-relaxed ${isDayTheme ? 'text-slate-700' : 'text-slate-300'}`}>
                {t.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              aria-label="Dismiss notification"
              className={`p-1 rounded-md transition-colors ${
                isDayTheme
                  ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

