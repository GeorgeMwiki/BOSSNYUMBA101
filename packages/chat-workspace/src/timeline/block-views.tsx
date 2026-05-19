/**
 * Simple block-view renderers — one per `Block.kind` that doesn't
 * carry its own state-machine. The richer `GenUiBlockView` lives in
 * `./genui-view.tsx` because it owns expand/collapse + summary state.
 *
 * Split this way to keep every file under the 250-line guardrail.
 */

import { useMemo, useState } from 'react';

import type {
  ReferenceBlock,
  TextBlock,
  ThinkingBlock,
  VoiceBlock,
} from '../types';
import { parseMarkdownParagraphs } from './markdown-tokens';
import { renderSegment } from './segments';

export { GenUiBlockView, type GenUiBlockViewProps, type GenUiSlotProps } from './genui-view';

export function TextBlockView({
  block,
  onReferenceClick,
}: {
  readonly block: TextBlock;
  readonly onReferenceClick?: (id: string) => void;
}) {
  const paragraphs = useMemo(
    () => parseMarkdownParagraphs(block.markdown),
    [block.markdown],
  );
  return (
    <div data-testid="chat-block-text" data-block-id={block.id} id={block.id}>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          style={{ margin: '8px 0', lineHeight: 1.55, fontSize: 15, color: '#1f2937' }}
        >
          {p.segments.map((seg, j) => renderSegment(seg, j, onReferenceClick))}
        </p>
      ))}
    </div>
  );
}

export function ReferenceBlockView({
  block,
  onReferenceClick,
}: {
  readonly block: ReferenceBlock;
  readonly onReferenceClick?: (id: string) => void;
}) {
  return (
    <a
      data-testid="chat-block-reference"
      data-block-id={block.id}
      data-ref-to={block.refToBlockId}
      id={block.id}
      href={`#${block.refToBlockId}`}
      onClick={(e) => {
        e.preventDefault();
        const el = document.getElementById(block.refToBlockId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        onReferenceClick?.(block.refToBlockId);
      }}
      style={{
        display: 'inline-block',
        margin: '4px 0',
        padding: '4px 10px',
        background: '#e0f2fe',
        borderRadius: 999,
        color: '#0c4a6e',
        fontSize: 13,
        textDecoration: 'none',
      }}
    >
      {'↑ '}
      {block.label}
    </a>
  );
}

export function VoiceBlockView({ block }: { readonly block: VoiceBlock }) {
  return (
    <div
      data-testid="chat-block-voice"
      data-block-id={block.id}
      id={block.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: '#ede9fe',
        borderRadius: 12,
        margin: '8px 0',
      }}
    >
      <span aria-hidden style={{ fontSize: 18 }}>
        {'🎤'}
      </span>
      <audio
        controls
        preload="none"
        src={block.audio.url}
        data-mimetype={block.audio.mimeType}
      />
      <span style={{ fontSize: 12, color: '#5b21b6' }}>
        {Math.round(block.audio.durationMs / 1000)}s
      </span>
      {block.transcript && (
        <span
          data-testid="chat-block-voice-transcript"
          style={{ fontSize: 13, color: '#4c1d95' }}
        >
          {block.transcript}
        </span>
      )}
    </div>
  );
}

export function ThinkingBlockView({ block }: { readonly block: ThinkingBlock }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      data-testid="chat-block-thinking"
      data-block-id={block.id}
      id={block.id}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      style={{
        margin: '6px 0',
        padding: '6px 10px',
        background: '#f1f5f9',
        borderRadius: 8,
        fontSize: 13,
        color: '#475569',
      }}
    >
      <summary style={{ cursor: 'pointer' }}>thinking{'…'}</summary>
      <p style={{ margin: '6px 0 0 0' }}>{block.summary}</p>
    </details>
  );
}
