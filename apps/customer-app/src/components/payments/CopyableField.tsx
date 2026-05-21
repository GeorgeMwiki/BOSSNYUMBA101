'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyableFieldProps {
  readonly label: string;
  readonly value: string;
  readonly testId?: string;
}

/**
 * Read-only field with copy-to-clipboard icon. Used for bank-transfer
 * details (account number, sort code, reference).
 */
export function CopyableField({ label, value, testId }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // Clipboard API can be denied (insecure context, permissions). The
      // value is still selectable in the DOM, so no visible failure
      // surface is needed beyond the silent no-op.
      console.error('Clipboard write failed:', err);
    }
  }, [value]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3" data-testid={testId}>
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <code className="break-all font-mono text-sm text-white">{value}</code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${label}`}
          className="flex-shrink-0 rounded-full p-2 text-gray-300 hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <Check className="h-4 w-4 text-success-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
