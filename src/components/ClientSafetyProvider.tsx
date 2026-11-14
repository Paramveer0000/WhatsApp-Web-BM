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
      if (
        message.includes('M_ID') ||
        message.includes('chrome-extension://') ||
        message.includes('moz-extension://') ||
        stack.includes('chrome-extension://') ||
        stack.includes('moz-extension://') ||
        message.includes('ResizeObserver loop')
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
      if (
        message.includes('M_ID') ||
        message.includes('Script error.') ||
        filename.includes('extension') ||
        filename.includes('chrome-extension://') ||
        filename.includes('moz-extension://') ||
        message.includes('ResizeObserver loop')
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

