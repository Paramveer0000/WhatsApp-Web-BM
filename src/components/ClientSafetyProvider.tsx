'use client';

import React, { useEffect } from 'react';
import Toaster from './Toaster';
import ClickDoctor from './ClickDoctor';
import { toast } from '@/lib/toast';

export default function ClientSafetyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
          ? reason
          : 'Unhandled promise rejection';

      // Avoid double toast if it was already an ApiError (ApiError already shows a toast)
      if (reason && reason.name === 'ApiError') return;

      // Filter out third-party browser extensions errors (e.g. Chrome extensions searching for M_ID, injecting scripts)
      const stack = String(reason?.stack || '');
      const rawText = `${message} ${stack} ${String(reason)}`.toLowerCase();
      if (
        rawText.includes('m_id') ||
        rawText.includes('chrome-extension') ||
        rawText.includes('moz-extension') ||
        rawText.includes('safari-extension') ||
        rawText.includes('wpp') ||
        (rawText.includes('whatsapp') && rawText.includes('extension')) ||
        rawText.includes('resizeobserver loop') ||
        rawText.includes('script error')
      ) {
        console.warn('[Ignored Browser Extension Rejection]', message);
        return;
      }

      console.error('[Unhandled Rejection]', reason);
      toast.error(message, 'Promise Error');

      fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: message,
          stack: reason?.stack,
          route: window.location.pathname,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});
    };

    const handleWindowError = (event: ErrorEvent) => {
      const message = event.message || 'Script error occurred';
      const filename = String(event.filename || '');

      // Ignore third-party extension errors
      const stack = String(event.error?.stack || '');
      const rawText = `${message} ${filename} ${stack}`.toLowerCase();
      if (
        rawText.includes('m_id') ||
        rawText.includes('script error') ||
        rawText.includes('extension') ||
        rawText.includes('wpp') ||
        rawText.includes('resizeobserver loop')
      ) {
        console.warn('[Ignored Browser Extension Error]', message);
        return;
      }

      console.error('[Window Error]', event.error || message);
      toast.error(message, 'Script Error');

      fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: message,
          stack: event.error?.stack,
          route: window.location.pathname,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {});
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleWindowError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleWindowError);
    };
  }, []);

  return (
    <>
      {children}
      <Toaster />
      <ClickDoctor />
    </>
  );
}

