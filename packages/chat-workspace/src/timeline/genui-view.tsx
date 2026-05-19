/**
 * `<GenUiBlockView>` — renders an inline ag-ui block.
 *
 * On narrow viewports, large parts (chart / table / map / etc.)
 * collapse to a summary card with a tap-to-expand affordance. The
 * caller supplies a `renderGenUi` slot — without one, we fall back to
 * the neutral summary so the package can ship without bundling the
 * full genui registry.
 *
 * Split out from `./block-views.tsx` to keep both files under the
 * 250-line guardrail.
 */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AgUiUiPart } from '@bossnyumba/genui';

import type { GenUiBlock, Turn } from '../types';
import { shouldCollapseOnNarrow, summarisePart } from './responsive';

export interface GenUiSlotProps {
  readonly part: AgUiUiPart;
  readonly blockId: string;
  readonly turnId: string;
}

export interface GenUiBlockViewProps {
  readonly block: GenUiBlock;
  readonly turn: Turn;
  readonly narrow: boolean;
  readonly renderGenUi?: (props: GenUiSlotProps) => ReactNode;
  readonly onPin?: (block: GenUiBlock, turn: Turn) => void;
}

export function GenUiBlockView({
  block,
  turn,
  narrow,
  renderGenUi,
  onPin,
}: GenUiBlockViewProps) {
  const [expanded, setExpanded] = useState(false);
  const collapse = narrow && shouldCollapseOnNarrow(block.part) && !expanded;
  const summary = useMemo(() => summarisePart(block.part), [block.part]);

  if (collapse) {
    return (
      <div
        data-testid="chat-block-genui-collapsed"
        data-block-id={block.id}
        data-part-kind={block.part.kind}
        id={block.id}
        style={{
          margin: '8px 0',
          padding: '12px',
          border: '1px dashed #94a3b8',
          borderRadius: 12,
          background: '#f8fafc',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, color: '#475569' }}>{summary}</span>
          <button
            type="button"
            data-testid="chat-block-genui-expand"
            onClick={() => setExpanded(true)}
            style={{
              background: '#0ea5e9',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Tap to expand
          </button>
        </div>
      </div>
    );
  }

  return (
    <figure
      data-testid="chat-block-genui"
      data-block-id={block.id}
      data-part-kind={block.part.kind}
      id={block.id}
      style={{ margin: '10px 0', padding: 0 }}
    >
      <div
        style={{
          padding: 12,
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          background: '#fff',
        }}
      >
        {renderGenUi ? (
          renderGenUi({ part: block.part, blockId: block.id, turnId: turn.id })
        ) : (
          <div
            data-testid="chat-block-genui-placeholder"
            style={{ color: '#64748b', fontSize: 13 }}
          >
            {summary}
          </div>
        )}
      </div>
      {onPin && (
        <button
          type="button"
          data-testid="chat-block-pin"
          onClick={() => onPin(block, turn)}
          style={{
            marginTop: 6,
            background: 'transparent',
            border: '1px solid #cbd5e1',
            color: '#334155',
            fontSize: 12,
            padding: '3px 10px',
            borderRadius: 999,
            cursor: 'pointer',
          }}
        >
          Pin to blackboard
        </button>
      )}
      {block.anchor && (
        <figcaption style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
          ref: {block.anchor}
        </figcaption>
      )}
    </figure>
  );
}
