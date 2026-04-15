import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value: ToastContextValue = {
    push,
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const styles: Record<ToastKind, { bg: string; border: string; text: string; icon: React.ElementType }> = {
    success: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: CheckCircle },
    error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertTriangle },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info },
  };
  const s = styles[toast.kind];
  const Icon = s.icon;
  return (
    <div
      className={`${s.bg} ${s.border} ${s.text} border rounded-lg shadow-sm p-3 flex items-start gap-3`}
      role="status"
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm">{toast.message}</p>
      <button onClick={onClose} className="opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback no-op so pages don't crash if mounted outside provider in tests.
    return {
      push: () => undefined,
      success: () => undefined,
      error: () => undefined,
      info: () => undefined,
    };
  }
  return ctx;
}

// Convenience hook: show a toast for a known duration after state flips.
export function useAutoToast(message: string | null, kind: ToastKind = 'info') {
  const { push } = useToast();
  useEffect(() => {
    if (message) push(kind, message);
  }, [message, kind, push]);
}
