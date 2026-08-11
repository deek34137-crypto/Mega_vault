'use client';

import { useState, useCallback } from 'react';
import { ToastMessage, ToastType } from '@/components/ui/Toast';

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    toastSuccess: (title: string, msg?: string) => addToast(title, msg, 'success'),
    toastError: (title: string, msg?: string) => addToast(title, msg, 'error'),
    toastInfo: (title: string, msg?: string) => addToast(title, msg, 'info'),
  };
}
