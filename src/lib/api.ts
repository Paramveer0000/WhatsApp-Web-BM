'use client';

import { toast } from '@/lib/toast';

export interface ApiErrorPayload {
  code?: string;
  message: string;
  details?: any;
  requestId?: string;
}

export class ApiError extends Error {
  public code?: string;
  public details?: any;
  public status: number;
  public requestId?: string;

  constructor(status: number, message: string, code?: string, details?: any, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  silent?: boolean; // if true, suppresses auto toast on error
}

async function safeParseJson(res: Response): Promise<{ isJson: boolean; data: any; rawText: string }> {
  const text = await res.text();
  if (!text || text.trim() === '') {
    return { isJson: false, data: null, rawText: '' };
  }
  try {
    const json = JSON.parse(text);
    return { isJson: true, data: json, rawText: text };
  } catch {
    return { isJson: false, data: null, rawText: text };
  }
}

export async function request<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 30000, silent = false, headers, ...rest } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        Accept: 'application/json',
        ...headers
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const parsed = await safeParseJson(res);

    if (!res.ok) {
      let errorMessage = 'An unexpected error occurred';
      let errorCode = `HTTP_${res.status}`;
      let errorDetails: any = null;
      let requestId: string | undefined;

      if (parsed.isJson && parsed.data) {
        if (typeof parsed.data.error === 'string') {
          errorMessage = parsed.data.error;
        } else if (parsed.data.error && typeof parsed.data.error === 'object') {
          errorMessage = parsed.data.error.message || errorMessage;
          errorCode = parsed.data.error.code || errorCode;
          errorDetails = parsed.data.error.details || null;
          requestId = parsed.data.error.requestId;
        } else if (typeof parsed.data.message === 'string') {
          errorMessage = parsed.data.message;
        }
      } else if (parsed.rawText) {
        // Strip HTML if server returned an HTML error page (e.g. 502/504 gateway)
        const stripped = parsed.rawText.replace(/<[^>]*>?/gm, '').trim();
        errorMessage = stripped.length > 200 ? `${stripped.slice(0, 197)}...` : (stripped || `Server error (${res.status})`);
      } else {
        errorMessage = `Request failed with status ${res.status}`;
      }

      const apiErr = new ApiError(res.status, errorMessage, errorCode, errorDetails, requestId);

      if (!silent) {
        toast.error(errorMessage, `Error (${res.status})`);
      }

      throw apiErr;
    }

    return (parsed.isJson ? parsed.data : parsed.rawText) as T;
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    const isTimeout = err.name === 'AbortError';
    const message = isTimeout ? 'Request timed out after 30 seconds' : (err.message || 'Network error');
    const apiErr = new ApiError(isTimeout ? 408 : 0, message, isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR');

    if (!silent) {
      toast.error(message, isTimeout ? 'Timeout' : 'Network Error');
    }

    throw apiErr;
  }
}

export const api = {
  get: <T = any>(url: string, options?: RequestOptions) =>
    request<T>(url, { method: 'GET', ...options }),

  post: <T = any>(url: string, body?: any, options?: RequestOptions) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = isFormData
      ? { ...options?.headers }
      : { 'Content-Type': 'application/json', ...options?.headers };

    return request<T>(url, {
      method: 'POST',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
      headers,
      ...options
    });
  },

  put: <T = any>(url: string, body?: any, options?: RequestOptions) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = isFormData
      ? { ...options?.headers }
      : { 'Content-Type': 'application/json', ...options?.headers };

    return request<T>(url, {
      method: 'PUT',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
      headers,
      ...options
    });
  },

  patch: <T = any>(url: string, body?: any, options?: RequestOptions) => {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = isFormData
      ? { ...options?.headers }
      : { 'Content-Type': 'application/json', ...options?.headers };

    return request<T>(url, {
      method: 'PATCH',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
      headers,
      ...options
    });
  },

  delete: <T = any>(url: string, options?: RequestOptions) =>
    request<T>(url, { method: 'DELETE', ...options }),

  upload: <T = any>(url: string, formData: FormData, options?: RequestOptions) =>
    request<T>(url, {
      method: 'POST',
      body: formData,
      ...options
    })
};
