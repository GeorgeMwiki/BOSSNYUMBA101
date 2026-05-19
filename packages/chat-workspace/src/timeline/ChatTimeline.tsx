/**
 * `<ChatTimeline>` — the conversation-as-stream renderer.
 *
 * Mixes prose + ag-ui parts inline. `[ref:<block-id>]` tokens resolve
 * to scroll-into-view links. Large genui parts collapse to a summary
 * card under {@link COLLAPSE_BREAKPOINT_PX} px width.
 *
 * Presentation-only — the component does NOT own the message list (the
 * caller passes turns) and does NOT open the streaming connection (the
 * caller wires that to J8). This keeps the package portable across
 * the four BOSSNYUMBA portals + the offline-replay path.
 *
 * Per the J9 anti-stall guardrails, this file is kept thin; the
 * per-kind block views live in `./block-views.tsx`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { Block, GenUiBlock, Turn } from '../types';
import {
  GenUiBlockView,
  ReferenceBlockView,
  TextBlockView,
  ThinkingBlockView,
  VoiceBlockView,
  type GenUiSlotProps,
} from './block-views';
import { COLLAPSE_BREAKPOINT_PX } from './responsive';

export type { GenUiSlotProps };

export interface ChatTimelineProps {
  readonly turns: ReadonlyArray<Turn>;
  /**
   * Renderer for a genui block. The default is a placeholder so the
   * package can ship without bundling the entire genui registry; the
   * portal wires `({ part }) => <AdaptiveRenderer parts={[part]} />`.
   */
  readonly renderGenUi?: (props: GenUiSlotProps) => ReactNode;
  /**
   * Optional callback when the owner pins a genui block. Wired by the
   * (deferred) `<Blackboard>` panel — when no callback is given, the
   * pin button is not rendered.
   */
  readonly onPin?: (block: GenUiBlock, turn: Turn) => void;
  /** Optional callback for cross-references — the owner taps a `[ref:...]`. */
  readonly onReferenceClick?: (refToBlockId: string) => void;
  /** Optional viewport width override; defaults to `window.innerWidth`. */
  readonly viewportWidthPx?: number;
  /** Test-only class hook for snapshot tests. */
  readonly className?: string;
}

interface RenderBlockArgs {
  readonly block: Block;
  readonly turn: Turn;
  readonly narrow: boolean;
  readonly registerAnchor: (blockId: string, el: HTMLElement | null) => void;
  readonly renderGenUi?: (props: GenUiSlotProps) => ReactNode;
  readonly onPin?: (block: GenUiBlock, turn: Turn) => void;
  readonly onReferenceClick?: (refToBlockId: string) => void;
}

function renderBlock(args: RenderBlockArgs): ReactNode {
  const { block, turn, narrow, registerAnchor, renderGenUi, onPin, onReferenceClick } = args;
  const setRef = (el: HTMLElement | null): void => {
    registerAnchor(block.id, el);
  };

  switch (block.kind) {
    case 'text':
      return (
        <div key={block.id} ref={setRef}>
          <TextBlockView block={block} onReferenceClick={onReferenceClick} />
        </div>
      );
    case 'genui':
      return (
        <div key={block.id} ref={setRef}>
          <GenUiBlockView
            block={block}
            turn={turn}
            narrow={narrow}
            renderGenUi={renderGenUi}
            onPin={onPin}
          />
        </div>
      );
    case 'reference':
      return (
        <div key={block.id} ref={setRef}>
          <ReferenceBlockView block={block} onReferenceClick={onReferenceClick} />
        </div>
      );
    case 'voice':
      return (
        <div key={block.id} ref={setRef}>
          <VoiceBlockView block={block} />
        </div>
      );
    case 'thinking':
      return (
        <div key={block.id} ref={setRef}>
          <ThinkingBlockView block={block} />
        </div>
      );
    default: {
      const exhaustive: never = block;
      void exhaustive;
      return null;
    }
  }
}

function roleBackground(role: Turn['role']): string {
  switch (role) {
    case 'owner':
      return '#f0f9ff';
    case 'md':
      return '#fffbeb';
    case 'internal-admin':
      return '#f0fdf4';
    default:
      return '#fff';
  }
}

function roleLabel(role: Turn['role']): string {
  switch (role) {
    case 'owner':
      return 'You';
    case 'md':
      return 'MD';
    case 'internal-admin':
      return 'Admin';
    default:
      return role;
  }
}

export function ChatTimeline({
  turns,
  renderGenUi,
  onPin,
  onReferenceClick,
  viewportWidthPx,
  className,
}: ChatTimelineProps) {
  const anchorRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return viewportWidthPx ?? window.innerWidth;
    }
    return viewportWidthPx ?? 1024;
  });

  const registerAnchor = useCallback((blockId: string, el: HTMLElement | null) => {
    const map = anchorRefs.current;
    if (el) {
      map.set(blockId, el);
    } else {
      map.delete(blockId);
    }
  }, []);

  useEffect(() => {
    if (typeof viewportWidthPx === 'number') {
      setWidth(viewportWidthPx);
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }
    const onResize = (): void => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [viewportWidthPx]);

  const narrow = width < COLLAPSE_BREAKPOINT_PX;

  return (
    <div
      data-testid="chat-timeline"
      data-narrow={narrow ? 'true' : 'false'}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: narrow ? 12 : 18,
        background: '#fff',
      }}
    >
      {turns.map((turn) => (
        <article
          key={turn.id}
          data-testid="chat-turn"
          data-turn-id={turn.id}
          data-role={turn.role}
          style={{
            background: roleBackground(turn.role),
            borderRadius: 16,
            padding: 14,
          }}
        >
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
              fontSize: 11,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <span>{roleLabel(turn.role)}</span>
            <time dateTime={turn.timestamp}>{turn.timestamp}</time>
          </header>
          {turn.blocks.map((block) =>
            renderBlock({
              block,
              turn,
              narrow,
              registerAnchor,
              renderGenUi,
              onPin,
              onReferenceClick,
            }),
          )}
        </article>
      ))}
    </div>
  );
}
