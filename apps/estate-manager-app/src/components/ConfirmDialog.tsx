'use client';

import { cn } from '@bossnyumba/design-system';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  className?: string;
}

const variantConfig = {
  danger: {
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    icon: 'bg-red-100 text-red-600',
  },
  warning: {
    confirmClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    icon: 'bg-amber-100 text-amber-600',
  },
  default: {
    confirmClass: 'bg-primary-600 hover:bg-primary-700 text-white',
    icon: 'bg-primary-100 text-primary-600',
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
  className,
}: ConfirmDialogProps) {
  if (!open) return null;

  const config = variantConfig[variant];

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative bg-white w-full max-w-md rounded-t-2xl sm:rounded-xl p-6 shadow-xl',
          'animate-in slide-in-from-bottom duration-200 sm:slide-in-from-bottom-0',
          className
        )}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">{message}</p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              'flex-1 py-2.5 px-4 rounded-lg font-medium disabled:opacity-50',
              config.confirmClass
            )}
          >
            {loading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
