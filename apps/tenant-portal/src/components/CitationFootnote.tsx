'use client';

import { useState } from 'react';
import type { AskCitation } from '@/lib/ask-client';

interface Props {
  readonly citation: AskCitation;
  readonly index: number;
}

/**
 * Collapsible footnote. Renders as a small numbered chip; clicking it
 * expands the inline source detail. Keyboard-accessible.
 */
export function CitationFootnote({ citation, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <span className="inline-block">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 inline-flex items-center rounded-full border border-ink-muted/40 bg-surface px-2 py-0.5 text-xs text-ink-muted hover:border-brand hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand"
        aria-expanded={expanded}
        aria-label={`Citation ${index + 1}: ${citation.label}`}
      >
        [{index + 1}]
      </button>
      {expanded ? (
        <span className="mt-1 block rounded-md border border-ink-muted/20 bg-surface p-2 text-xs text-ink-muted">
          <span className="font-medium text-ink">Source:</span> {citation.label}{' '}
          <span className="text-ink-muted/70">({citation.source})</span>
        </span>
      ) : null}
    </span>
  );
}
