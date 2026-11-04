'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export default function GuardrailsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?tab=guardrails');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0b141a] text-slate-100 flex items-center justify-center font-sans">
      <div className="flex items-center gap-3 text-emerald-400 font-mono text-sm">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>Loading Anti-Ban Guardrails Tab...</span>
      </div>
    </div>
  );
}
