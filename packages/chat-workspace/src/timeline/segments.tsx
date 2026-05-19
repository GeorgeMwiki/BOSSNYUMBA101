/**
 * Inline-segment renderer — turns an `MdSegment[]` into ReactNodes.
 *
 * Split out from `ChatTimeline.tsx` to keep that file under the
 * 250-line module-size guardrail. The renderer is presentation-only;
 * it owns no state.
 */

import type { ReactNode } from 'react';

import type { MdSegment } from './markdown-tokens';

export function renderSegment(
  segment: MdSegment,
  i: number,
  onReferenceClick: ((id: string) => void) | undefined,
): ReactNode {
  if (segment.kind === 'text') {
    return <span key={i}>{segment.text}</span>;
  }
  if (segment.kind === 'emphasis') {
    if (segment.strength === 'strong') {
      return <strong key={i}>{segment.text}</strong>;
    }
    return <em key={i}>{segment.text}</em>;
  }
  // reference
  return (
    <a
      key={i}
      data-testid="chat-timeline-ref"
      data-ref-to={segment.refToBlockId}
      href={`#${segment.refToBlockId}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(segment.refToBlockId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        onReferenceClick?.(segment.refToBlockId);
      }}
      style={{
        color: '#0ea5e9',
        textDecoration: 'underline',
        cursor: 'pointer',
      }}
    >
      {segment.label}
    </a>
  );
}
