'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-6 antialiased">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-xl">
            !
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Critical System Error</h1>
            <p className="text-sm text-slate-400 mt-2">
              A critical error crashed the main application layout.
            </p>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-rose-300 text-left overflow-auto max-h-32">
            {error.message || 'Fatal Application Error'}
          </div>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
