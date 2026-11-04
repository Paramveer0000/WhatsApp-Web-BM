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

