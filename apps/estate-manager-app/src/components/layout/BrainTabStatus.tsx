'use client';

/**
 * BrainTabStatus — header indicator showing brain-tab capture state.
 *
 * Two signals fold into one badge:
 *   1. "capture active" — Piece L's dispatch-router has at least one
 *      open tab in the user's session
 *   2. pending module-update proposal count from Piece B
 *
 * Wave-3 INT-4 ships the surface; the underlying SSE / polling sources
 * are wired in INT-5 once dispatch-router + module-orchestrator expose
 * their api-client ports.
 *
 * The component is intentionally renderer-pure: counts come in as
 * props so tests do not need network mocking. The header wires a
 * sibling hook that fetches the data.
 */

import Link from 'next/link';
import { Brain, Bell } from 'lucide-react';

export interface BrainTabStatusProps {
  /** True when at least one tab is actively capturing brain state. */
  readonly captureActive: boolean;
  /** Count of pending `module_update_proposals`. */
  readonly pendingProposalCount: number;
  /** href used when the operator clicks through. */
  readonly proposalsHref?: string;
}

export function BrainTabStatus({
  captureActive,
  pendingProposalCount,
  proposalsHref = '/proposals',
}: BrainTabStatusProps): JSX.Element {
  return (
    <Link
      href={proposalsHref}
      data-testid="brain-tab-status"
      data-capture-active={captureActive ? 'true' : 'false'}
      data-pending-proposals={String(pendingProposalCount)}
      className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs"
      aria-label={`Brain capture ${
        captureActive ? 'active' : 'idle'
      }. ${pendingProposalCount} pending proposals.`}
    >
      <span className="relative inline-flex items-center">
        <Brain
          className={`h-4 w-4 ${
            captureActive ? 'text-amber-400' : 'text-muted-foreground'
          }`}
        />
        {captureActive ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 animate-pulse"
          />
        ) : null}
      </span>
      <span className="hidden sm:inline text-muted-foreground">
        {captureActive ? 'capture active' : 'capture idle'}
      </span>
      {pendingProposalCount > 0 ? (
        <span
          data-testid="brain-tab-status-proposal-badge"
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-400"
        >
          <Bell className="h-3 w-3" />
          {pendingProposalCount}
        </span>
      ) : null}
    </Link>
  );
}
