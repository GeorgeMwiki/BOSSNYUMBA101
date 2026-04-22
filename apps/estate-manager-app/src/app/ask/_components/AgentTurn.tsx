'use client';

/**
 * AgentTurn — renders a single agent turn, folded from a stream of
 * AgentEvents.
 *
 * Layout inside the card:
 *   1. Plan           → numbered chip strip
 *   2. Thoughts       → "Show reasoning" toggle, collapsed by default
 *   3. Tool calls     → chip strip, live status (running / done / failed)
 *   4. Text           → rendered as streamed markdown-lite
 *   5. Citations      → inline [1] superscripts, expandable pane
 *   6. Artifacts      → inline card with "Expand" button
 *   7. Error          → dismissible banner
 *
 * No mock data. Everything here is derived from the live AgentTurnState.
 */

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Maximize2,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import type {
  AgentTurnState,
  Artifact,
  Citation,
} from './types';

export interface AgentTurnProps {
  readonly state: AgentTurnState;
  readonly onExpandArtifact: (artifact: Artifact) => void;
  readonly onFocusCitation: (citation: Citation) => void;
}

export function AgentTurn({
  state,
  onExpandArtifact,
  onFocusCitation,
}: AgentTurnProps): JSX.Element {
  const hasAnyContent =
    state.plan !== null ||
    state.thoughts.length > 0 ||
    state.toolCalls.length > 0 ||
    state.text.length > 0 ||
    state.artifacts.length > 0 ||
    state.error !== null;

  return (
    <article
      className="rounded-xl border border-border bg-surface p-5"
      aria-busy={state.status === 'streaming'}
    >
      <header className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-signal-500/15">
          <Sparkles className="h-3 w-3 text-signal-500" />
        </div>
        <span className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
          Me
        </span>
        {state.status === 'streaming' && (
          <span className="inline-flex items-center gap-1 font-mono text-[0.62rem] text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>thinking…</span>
          </span>
        )}
        {state.status === 'done' && state.totalMs !== null && (
          <span className="ml-auto font-mono text-[0.62rem] text-neutral-500 tabular-nums">
            {Math.round(state.totalMs)}ms
          </span>
        )}
      </header>

      {state.plan !== null && state.plan.length > 0 && (
        <PlanStrip steps={state.plan} />
      )}

      {state.thoughts.length > 0 && <ThoughtsBlock thoughts={state.thoughts} />}

      {state.toolCalls.length > 0 && <ToolChipStrip calls={state.toolCalls} />}

      {state.text.length > 0 && (
        <TextBlock
          text={state.text}
          citations={state.citations}
          onFocusCitation={onFocusCitation}
        />
      )}

      {state.artifacts.length > 0 && (
        <div className="mt-4 space-y-3">
          {state.artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              onExpand={() => onExpandArtifact(artifact)}
            />
          ))}
        </div>
      )}

      {state.error && <ErrorBanner message={state.error} />}

      {!hasAnyContent && state.status === 'streaming' && (
        <p className="text-sm italic text-neutral-500">
          Give me a second — I'm pulling this together.
        </p>
      )}
    </article>
  );
}

/* ──────────────────────────── Sub-blocks ────────────────────────────── */

function PlanStrip({ steps }: { readonly steps: ReadonlyArray<string> }): JSX.Element {
  return (
    <div className="mb-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-widest text-neutral-500">
        Thinking through this:
      </p>
      <ol className="mt-2 flex flex-wrap gap-1.5">
        {steps.map((step, idx) => (
          <li
            key={`${idx}-${step}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-signal-500/10 px-2.5 py-1 text-xs text-foreground"
          >
            <span className="font-mono text-[0.62rem] font-semibold text-signal-500 tabular-nums">
              {idx + 1}
            </span>
            <span className="truncate">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ThoughtsBlock({
  thoughts,
}: {
  readonly thoughts: ReadonlyArray<string>;
}): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[0.65rem] uppercase tracking-widest text-neutral-500 transition-colors duration-fast hover:bg-surface-raised hover:text-foreground"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {open ? 'Hide reasoning' : 'Show reasoning'}
        <span className="tabular-nums">({thoughts.length})</span>
      </button>
      {open && (
        <ol className="mt-2 space-y-2 rounded-md border border-border bg-surface-raised p-3">
          {thoughts.map((thought, idx) => (
            <li
              key={idx}
              className="border-l-2 border-signal-500/30 pl-3 text-xs leading-relaxed text-neutral-500"
            >
              {thought}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ToolChipStrip({
  calls,
}: {
  readonly calls: ReadonlyArray<{
    readonly callId: string;
    readonly toolName: string;
    readonly status: 'running' | 'done' | 'failed';
    readonly latencyMs?: number;
  }>;
}): JSX.Element {
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {calls.map((call) => {
        const Icon =
          call.status === 'running'
            ? Loader2
            : call.status === 'failed'
            ? XCircle
            : CheckCircle2;
        const iconClass =
          call.status === 'running'
            ? 'h-3 w-3 animate-spin text-signal-500'
            : call.status === 'failed'
            ? 'h-3 w-3 text-danger'
            : 'h-3 w-3 text-success';
        const label =
          call.status === 'running'
            ? `Checking ${call.toolName}`
            : call.status === 'failed'
            ? `${call.toolName} failed`
            : `Checked ${call.toolName}`;
        return (
          <span
            key={call.callId}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2.5 py-1 font-mono text-[0.65rem] text-foreground"
            title={call.toolName}
          >
            <Wrench className="h-3 w-3 text-neutral-500" />
            <Icon className={iconClass} />
            <span>{label}</span>
            {typeof call.latencyMs === 'number' && (
              <span className="text-neutral-500 tabular-nums">
                {Math.round(call.latencyMs)}ms
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * TextBlock — render streamed text with inline citation superscripts.
 *
 * Citations are referenced in text by a pattern the agent emits:
 *   "…foo[^c_abc] bar[^c_xyz]"
 *
 * We turn each `[^<id>]` token into a clickable <sup>[n]</sup> that
 * calls onFocusCitation with the matching citation. Unknown refs
 * render as literal text.
 *
 * We deliberately do NOT run a full markdown parser — keep the bundle
 * tiny and avoid surprises. We honour only newlines as paragraph breaks.
 */
function TextBlock({
  text,
  citations,
  onFocusCitation,
}: {
  readonly text: string;
  readonly citations: ReadonlyArray<Citation>;
  readonly onFocusCitation: (c: Citation) => void;
}): JSX.Element {
  const citationById = useMemo(() => {
    const map = new Map<string, { readonly citation: Citation; readonly index: number }>();
    citations.forEach((citation, idx) => {
      map.set(citation.id, { citation, index: idx + 1 });
    });
    return map;
  }, [citations]);

  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {paragraphs.map((para, idx) => (
        <p key={idx} className="whitespace-pre-wrap">
          {renderWithCitations(para, citationById, onFocusCitation)}
        </p>
      ))}
    </div>
  );
}

function renderWithCitations(
  text: string,
  citations: ReadonlyMap<string, { readonly citation: Citation; readonly index: number }>,
  onFocusCitation: (c: Citation) => void,
): ReadonlyArray<JSX.Element | string> {
  // Split on the [^<id>] pattern while keeping the matches.
  const parts = text.split(/(\[\^[a-zA-Z0-9_\-:.]+\])/g);
  return parts.map((part, idx) => {
    const match = /^\[\^([a-zA-Z0-9_\-:.]+)\]$/.exec(part);
    if (!match) return part;
    const ref = match[1];
    const hit = citations.get(ref);
    if (!hit) return part;
    return (
      <button
        key={idx}
        type="button"
        onClick={() => onFocusCitation(hit.citation)}
        className="mx-0.5 inline-flex items-center rounded bg-signal-500/15 px-1 align-super font-mono text-[0.6rem] font-semibold text-signal-500 transition-colors duration-fast hover:bg-signal-500/25"
        aria-label={`Citation ${hit.index}: ${hit.citation.label}`}
      >
        [{hit.index}]
      </button>
    );
  });
}

function ArtifactCard({
  artifact,
  onExpand,
}: {
  readonly artifact: Artifact;
  readonly onExpand: () => void;
}): JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface-raised p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-widest text-neutral-500">
            {formatArtifactKind(artifact.kind)}
          </p>
          <h4 className="mt-1 font-display text-base font-medium leading-tight tracking-tight">
            {artifact.title}
          </h4>
        </div>
        <button
          type="button"
          onClick={onExpand}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-signal-500 transition-colors duration-fast hover:bg-signal-500/10"
        >
          <Maximize2 className="h-3 w-3" />
          Expand
        </button>
      </header>
      <ArtifactPreview artifact={artifact} />
    </section>
  );
}

function formatArtifactKind(kind: Artifact['kind']): string {
  switch (kind) {
    case 'line_chart':
      return 'Line chart';
    case 'bar_chart':
      return 'Bar chart';
    case 'scrubbable_chart':
      return 'Chart';
    case 'node_map':
      return 'Relationship map';
    case 'table':
      return 'Table';
    case 'plan':
      return 'Plan';
    case 'forecast_card':
      return 'Forecast';
    case 'cohort_breakdown':
      return 'Cohort breakdown';
    default:
      return 'Artifact';
  }
}

function ArtifactPreview({ artifact }: { readonly artifact: Artifact }): JSX.Element {
  // A tiny summary preview — the full artifact renders in the right pane.
  const summary = summariseArtifactData(artifact);
  return (
    <p className="mt-2 text-xs leading-relaxed text-neutral-500">{summary}</p>
  );
}

function summariseArtifactData(artifact: Artifact): string {
  const { data } = artifact;
  if (data === null || typeof data !== 'object') {
    return 'Expand for detail.';
  }
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.rows)) {
    return `${record.rows.length} rows. Expand to scan.`;
  }
  if (Array.isArray(record.points)) {
    return `${record.points.length} data points. Expand to read.`;
  }
  if (Array.isArray(record.steps)) {
    return `${record.steps.length}-step plan. Expand to step through.`;
  }
  return 'Expand for detail.';
}

function ErrorBanner({ message }: { readonly message: string }): JSX.Element {
  const [dismissed, setDismissed] = useState<boolean>(false);
  if (dismissed) return <></>;
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-3 rounded-md border border-danger/40 bg-danger-subtle/30 p-3"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
      <p className="flex-1 text-sm leading-relaxed text-foreground">{message}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-surface-raised hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}
