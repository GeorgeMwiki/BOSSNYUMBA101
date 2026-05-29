/**
 * R1 — inline citations renderer
 * Ported from Borjie owner-web (Next.js) to BossNyumba owner-portal
 * (Vite + React SPA). The `'use client'` directive is dropped — the
 * component lives in a pure client bundle.
 *
 * Maps superscript Unicode digits (¹²³⁴⁵⁶⁷⁸⁹⁰) embedded inline within
 * a model-written brief sentence to clickable evidence chips that open
 * the source modal.
 *
 * Per the owner cockpit spec, every brief sentence carries
 * superscripted ¹²³ evidence chips with tap-to-source modal — every
 * claim cites a specific datum.
 *
 * Input contract — `text` is a markdown-flavoured string that the
 * brain has already authored. The evidence chip at position N
 * (1-indexed) corresponds to `evidenceIds[N-1]`. If the model emits a
 * chip index beyond the supplied id list we fall back to rendering
 * the raw glyph verbatim so we never lose information.
 *
 * Output contract — a flat React fragment of text spans interleaved
 * with clickable `<sup><button>` chips. We keep the renderer free of
 * any markdown parsing concerns (block-level layout is the caller's
 * job) so it composes inside paragraphs, list items, table cells.
 */

import { parseSuperscriptCitations } from './superscript-parser';

interface SuperscriptRendererProps {
  readonly text: string;
  readonly evidenceIds: ReadonlyArray<string>;
  readonly onSelectEvidence: (id: string) => void;
  readonly testId?: string;
}

export function SuperscriptRenderer({
  text,
  evidenceIds,
  onSelectEvidence,
  testId,
}: SuperscriptRendererProps): JSX.Element {
  const tokens = parseSuperscriptCitations(text);

  return (
    <span data-testid={testId ?? 'inline-citations'}>
      {tokens.map((token, idx) => {
        if (token.kind === 'text') {
          return <span key={`t-${idx}`}>{token.value}</span>;
        }
        // token.kind === 'citation'
        const evidenceId = evidenceIds[token.index - 1];
        if (!evidenceId) {
          // Index out of range: render raw glyph so we never silently
          // drop content. Tests assert this fallback.
          return (
            <sup key={`c-${idx}`} data-testid="inline-citation-orphan">
              {token.raw}
            </sup>
          );
        }
        return (
          <sup key={`c-${idx}`}>
            <button
              type="button"
              onClick={() => onSelectEvidence(evidenceId)}
              data-testid="inline-citation-chip"
              data-evidence-id={evidenceId}
              data-citation-index={token.index}
              aria-label={`Source ${token.index}`}
              className="ml-0.5 rounded-sm border border-emerald-300 bg-emerald-50 px-1 text-[10px] text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {token.raw}
            </button>
          </sup>
        );
      })}
    </span>
  );
}
