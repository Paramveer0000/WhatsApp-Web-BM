import { describe, it, expect, vi } from 'vitest';
import { toast } from '../src/lib/toast';
import { ApiError } from '../src/lib/api';

describe('Audit Fixes: Toast Notification Manager', () => {
  it('correctly queues and dispatches success toasts', () => {
    let capturedToasts: any[] = [];
    const unsubscribe = toast.subscribe((toasts) => {
      capturedToasts = toasts;
    });

    const id = toast.success('Campaign launched successfully!', 'Launched');
    expect(capturedToasts.length).toBeGreaterThan(0);
    const item = capturedToasts.find((t) => t.id === id);
    expect(item).toBeDefined();
    expect(item?.type).toBe('success');
    expect(item?.message).toBe('Campaign launched successfully!');
    expect(item?.title).toBe('Launched');

    // Dismiss
    toast.dismiss(id);
    expect(capturedToasts.find((t) => t.id === id)).toBeUndefined();

    unsubscribe();
  });

  it('correctly handles error toasts and warning toasts', () => {
    let capturedToasts: any[] = [];
    const unsubscribe = toast.subscribe((toasts) => {
      capturedToasts = toasts;
    });

    const errId = toast.error('Failed to connect to WhatsApp API', 'Network Error');
    const warnId = toast.warning('Please enter a Campaign Name');

    expect(capturedToasts.some((t) => t.id === errId && t.type === 'error')).toBe(true);
    expect(capturedToasts.some((t) => t.id === warnId && t.type === 'warning')).toBe(true);

    toast.clearAll();
    expect(capturedToasts.length).toBe(0);

    unsubscribe();
  });
});

describe('Audit Fixes: ApiError Normalization', () => {
  it('constructs structured ApiError with status and request ID', () => {
    const err = new ApiError(404, 'Template not found', 'NOT_FOUND', { templateId: 'xyz' }, 'req-12345');
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Template not found');
    expect(err.requestId).toBe('req-12345');
    expect(err.details).toEqual({ templateId: 'xyz' });
  });

  it('handles timeout status code 408', () => {
    const timeoutErr = new ApiError(408, 'Request timed out after 30 seconds', 'TIMEOUT');
    expect(timeoutErr.status).toBe(408);
    expect(timeoutErr.code).toBe('TIMEOUT');
  });
});
