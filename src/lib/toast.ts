'use client';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  createdAt: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public show(message: string, type: ToastType = 'info', title?: string, duration = 4500): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const toast: ToastItem = {
      id,
      type,
      message,
      title,
      duration,
      createdAt: Date.now()
    };

    // Keep max 5 visible toasts to avoid clutter
    this.toasts = [toast, ...this.toasts].slice(0, 5);
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  public success(message: string, title?: string, duration = 4000) {
    return this.show(message, 'success', title, duration);
  }

  public error(message: string, title?: string, duration = 6000) {
    return this.show(message, 'error', title, duration);
  }

  public info(message: string, title?: string, duration = 4500) {
    return this.show(message, 'info', title, duration);
  }

  public warning(message: string, title?: string, duration = 5000) {
    return this.show(message, 'warning', title, duration);
  }

  public dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public clearAll() {
    this.toasts = [];
    this.notify();
  }
}

export const toast = new ToastManager();

