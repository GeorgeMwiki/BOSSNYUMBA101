'use client';

import { Timer, AlertTriangle, CheckCircle } from 'lucide-react';

interface SLATimerProps {
  /** Minutes remaining (negative = breached) */
  minutesRemaining: number | null;
  /** Type of SLA: response or resolution */
  type: 'response' | 'resolution';
  /** Whether the SLA has been breached */
  breached?: boolean;
  /** Whether the SLA has been met (e.g. responded/resolved) */
  met?: boolean;
  /** Compact mode (hide type label) */
  compact?: boolean;
}

function formatTimeRemaining(minutes: number): string {
  if (minutes < 0) return 'Breached';
  if (minutes === 0) return 'Due now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function SLATimer({
  minutesRemaining,
  type,
  breached = false,
  met = false,
  compact = false,
}: SLATimerProps) {
  if (met) {
    return (
      <div className="flex items-center gap-2 text-success-600 text-sm">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>Met</span>
      </div>
    );
  }

  if (breached || (minutesRemaining !== null && minutesRemaining < 0)) {
    return (
      <div className="flex items-center gap-2 text-danger-600 text-sm font-medium">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>Breached</span>
      </div>
    );
  }

  if (minutesRemaining === null) return null;

  const isAtRisk = minutesRemaining < (type === 'response' ? 30 : 120);

  return (
    <div
      className={`flex items-center gap-2 text-sm ${
        isAtRisk ? 'text-warning-600 font-medium' : 'text-gray-600'
      }`}
    >
      <Timer className="w-4 h-4 flex-shrink-0" />
      <span>{formatTimeRemaining(minutesRemaining)}</span>
      {!compact && (
        <span className="text-gray-400 text-xs capitalize">{type}</span>
      )}
    </div>
  );
}
