'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Shield, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin@123');
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          router.push('/');
        } else if (!data.initialized) {
          setIsFirstRun(true);
        }
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-emerald-500 to-teal-700 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-950/50">
            <Send className="w-7 h-7 -rotate-12 translate-x-0.5" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BulkFlow Manager</h1>
          <p className="text-xs text-slate-400">
            {isFirstRun
              ? 'Welcome! Create your initial Administrator credentials.'
              : 'Sign in to your WhatsApp Campaign Gateway'}
          </p>
        </div>

        {isFirstRun && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>First-time setup detected. The account entered will be assigned the <strong>ADMIN</strong> role.</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="admin@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isFirstRun ? 'Create Admin & Sign In' : 'Sign In'}</span>
          </button>
        </form>

        <div className="pt-2 text-center text-slate-500 text-[11px]">
          Self-Hosted WhatsApp Web Campaign Gateway &bull; v2.0
        </div>
      </div>
    </div>
  );
}

