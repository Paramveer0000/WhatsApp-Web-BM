'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Info, X, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

interface InfoButtonProps {
  title: string;
  description: string;
  recommended?: string;
  whyItMatters?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  align?: 'left' | 'right' | 'center';
}

export default function InfoButton({
  title,
  description,
  recommended,
  whyItMatters,
  className = '',
  size = 'xs',
  align = 'center',
}: InfoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const sizeClasses = {
    xs: 'w-4 h-4 text-[10px]',
    sm: 'w-5 h-5 text-xs',
    md: 'w-6 h-6 text-sm',
  };

  const alignClasses = {
    left: 'left-0 origin-top-left',
    right: 'right-0 origin-top-right',
    center: 'left-1/2 -translate-x-1/2 origin-top',
  };

  return (
    <div ref={containerRef} className={`relative inline-flex items-center ml-1.5 align-middle z-10 ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/25 text-blue-400 hover:text-blue-300 border border-blue-500/30 transition-all cursor-pointer focus:outline-none`}
        title={`Click for info: ${title}`}
        aria-label={`Info about ${title}`}
      >
        <span className="font-serif font-black italic">i</span>
      </button>

      {isOpen && (
        <div
          onMouseLeave={() => setIsOpen(false)}
          className={`absolute top-full mt-2 w-72 sm:w-80 p-3.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl z-50 text-left normal-case tracking-normal font-sans text-xs ${alignClasses[align]} animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-serif font-black italic">
                i
              </span>
              <span>{title}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Description */}
          <p className="text-slate-300 text-[11px] leading-relaxed mb-2.5">
            {description}
          </p>

          {/* Recommended Setting */}
          {recommended && (
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2 mb-2 flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-emerald-200">
                <span className="font-semibold text-emerald-300">Recommended: </span>
                {recommended}
              </div>
            </div>
          )}

          {/* Why it Matters / Anti-Ban */}
          {whyItMatters && (
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2 flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-200">
                <span className="font-semibold text-amber-300">Why it matters: </span>
                {whyItMatters}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
