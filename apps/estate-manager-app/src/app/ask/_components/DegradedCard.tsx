'use client';

/**
 * DegradedCard — first-person degraded state for /ask.
 *
 * Renders one of: unavailable (503), unauthorized (401), forbidden
 * (403), network failure, generic error. Offers a retry button when
 * retry makes sense (everything except 401 / 403).
 */

import { AlertTriangle, Lock, ShieldAlert, WifiOff } from 'lucide-react';
import type { DegradedReason } from './types';

export interface DegradedCardProps {
  readonly reason: DegradedReason;
  readonly message: string;
  readonly onRetry?: () => void;
  readonly compact?: boolean;
}

export function DegradedCard({
  reason,
  message,
  onRetry,
  compact = false,
}: DegradedCardProps): JSX.Element {
  const canRetry = reason !== 'unauthorized' && reason !== 'forbidden' && onRetry;

  const Icon =
    reason === 'unauthorized'
      ? Lock
      : reason === 'forbidden'
      ? ShieldAlert
      : reason === 'network'
      ? WifiOff
      : AlertTriangle;

  const title =
    reason === 'unauthorized'
      ? "We haven't met yet today."
      : reason === 'forbidden'
      ? "I can't let you in here."
      : reason === 'unavailable'
      ? "I'm here but can't reach my memory right now."
      : reason === 'network'
      ? "I lost my connection."
      : 'Something went wrong.';

  return (
    <div
      role="alert"
      className={
        compact
          ? 'rounded-lg border border-border bg-surface-raised p-4'
          : 'rounded-xl border border-border bg-surface p-6'
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-500/10">
          <Icon className="h-4 w-4 text-signal-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-medium leading-tight tracking-tight">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{message}</p>
          {reason === 'unauthorized' && (
            <a
              href="/login"
              className="mt-4 inline-flex items-center rounded-md bg-signal-500 px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors duration-fast hover:bg-signal-400"
            >
              Sign in
            </a>
          )}
          {canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center rounded-md bg-signal-500 px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors duration-fast hover:bg-signal-400"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
