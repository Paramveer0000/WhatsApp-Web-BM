'use client';

import React, { useRef } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import { toast } from '@/lib/toast';

interface QrCodeSvgProps {
  url: string;
  title?: string;
  size?: number;
}

export function QrCodeSvg({ url, title, size = 200 }: QrCodeSvgProps) {
  const [copied, setCopied] = React.useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Use dynamic vector SVG QR generator API with high-contrast fallback
  // Encodes URL cleanly without any external heavyweight npm packages
  const encodedUrl = encodeURIComponent(url);
  const qrSvgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedUrl}&format=svg`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Form link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = async () => {
    try {
      const response = await fetch(qrSvgUrl);
      const svgText = await response.text();
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `qr-${title ? title.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'form'}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      toast.success('QR Code SVG downloaded successfully!');
    } catch {
      window.open(qrSvgUrl, '_blank');
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
      <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-inner flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSvgUrl}
          alt={`QR Code for ${title || url}`}
          width={size}
          height={size}
          className="rounded-lg"
          loading="lazy"
        />
      </div>

      <div className="mt-3 text-center max-w-[240px]">
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
          {title || 'Scan to Open Form'}
        </p>
        <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5" title={url}>
          {url}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 w-full">
        <button
          onClick={handleCopyLink}
          className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>

        <button
          onClick={handleDownloadQr}
          className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
      </div>
    </div>
  );
}
