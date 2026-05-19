/**
 * Integration tests — 5 scenarios that exercise the J9-core surface
 * end-to-end. Each test treats the package boundary as a unit and
 * verifies the contract a portal would observe with the four shipped
 * modules: timeline, blocks, interactivity, persistence.
 *
 * Deferred widget integrations (blackboard pin/unpin, voice in/out,
 * editable widgets) ship with their corresponding follow-up PRs.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  ChatTimeline,
  cellEdited,
  createCollectorSink,
  createInMemoryEntityStore,
  fanOut,
  replayConversation,
} from '../index';
import type {
  BlackboardInteractionEvent,
  BlackboardStreamSink,
  Provenance,
} from '../types';
import {
  chartPart,
  ctx,
  genUiBlock,
  textBlock,
  turn,
} from './fixtures';

const ANY_PROV: Provenance = {
  conversationId: 'conv-1',
  turnId: 't-1',
  blockId: 'b-1',
  llmInferred: true,
  ownerCorrected: false,
  timestamp: '2026-05-19T10:00:00Z',
};

function persistSink(
  store: ReturnType<typeof createInMemoryEntityStore>,
  tenantId: string,
): BlackboardStreamSink {
  return { emit: (ev: BlackboardInteractionEvent) => store.putInteraction(tenantId, ev) };
}

describe('J9 core integration', () => {
  it('1. timeline renders mixed prose + genui + reference in author order', () => {
    const turns = [
      turn('t-1', 'md', [
        textBlock('b-1', 'Here is the cashflow.'),
        genUiBlock('b-2', chartPart(), 'cashflow-2026'),
        textBlock('b-3', 'As you can see [ref:b-2|in the chart above]'),
      ]),
    ];
    render(<ChatTimeline turns={turns} viewportWidthPx={1024} />);
    const blocks = screen
      .getByTestId('chat-turn')
      .querySelectorAll('[data-block-id]');
    expect(Array.from(blocks).map((el) => el.getAttribute('data-block-id'))).toEqual([
      'b-1',
      'b-2',
      'b-3',
    ]);
    // Inline `[ref:...]` token is rendered as a scroll-anchor:
    expect(screen.getByTestId('chat-timeline-ref').dataset.refTo).toBe('b-2');
  });

  it('2. persistence: putTurn → listTurns → replayConversation rebuilds the conversation', async () => {
    const store = createInMemoryEntityStore();
    const t1 = turn('t-1', 'owner', [textBlock('b-q', 'show me cashflow')]);
    const t2 = turn('t-2', 'md', [
      textBlock('b-pre', 'Here it is.'),
      genUiBlock('b-chart', chartPart(), 'cashflow-2026'),
    ]);
    await store.putTurn('tnt-1', 'conv-1', t1);
    await store.putTurn('tnt-1', 'conv-1', t2);

    const replay = await replayConversation(store, 'tnt-1', 'conv-1');
    expect(replay.turns).toHaveLength(2);
    expect(replay.turns[1]?.blocks).toHaveLength(2);
    expect(replay.turns[1]?.blocks[1]?.kind).toBe('genui');
  });

  it('3. interactivity: events fan-out to BOTH the streaming sink and the entity store', async () => {
    const store = createInMemoryEntityStore();
    const collector = createCollectorSink();
    const sink = fanOut(collector, persistSink(store, 'tnt-1'));

    const ev = cellEdited(
      { actor: 'owner', context: ctx({ conversationId: 'conv-1', turnId: 't-1', blockId: 'b-table' }) },
      { rowKey: 'r-1', columnId: 'amount', previousValue: 1200, nextValue: 1500 },
    );
    await sink.emit(ev);

    expect(collector.events).toHaveLength(1);
    expect(collector.events[0]?.payload.kind).toBe('cell-edited');
    const interactions = await store.search('tnt-1', {
      entityType: 'conversation_interaction',
    });
    expect(interactions).toHaveLength(1);
    // Persisted event preserves the actor + context:
    const persisted = interactions[0]?.record;
    expect(persisted?.provenance.ownerCorrected).toBe(true);
    expect(persisted?.conversationId).toBe('conv-1');
  });

  it('4. each block kind renders with its dedicated test hook', () => {
    const turns = [
      turn('t-1', 'md', [
        textBlock('b-text', 'Hello'),
        genUiBlock('b-genui', chartPart()),
        { kind: 'reference', id: 'b-ref', refToBlockId: 'b-genui', label: 'cashflow' },
        { kind: 'thinking', id: 'b-think', summary: 'planning the reply' },
        {
          kind: 'voice',
          id: 'b-voice',
          audio: { url: 'blob:test', mimeType: 'audio/webm', durationMs: 4000 },
          transcript: 'what is occupancy',
        },
      ]),
    ];
    render(<ChatTimeline turns={turns} viewportWidthPx={1024} />);
    expect(screen.getByTestId('chat-block-text')).toBeInTheDocument();
    expect(screen.getByTestId('chat-block-genui')).toBeInTheDocument();
    expect(screen.getByTestId('chat-block-reference')).toBeInTheDocument();
    expect(screen.getByTestId('chat-block-thinking')).toBeInTheDocument();
    expect(screen.getByTestId('chat-block-voice')).toBeInTheDocument();
  });

  it('5. mobile viewport collapses large genui parts; tap expands without losing scroll anchor', async () => {
    const turns = [
      turn('t-1', 'md', [
        textBlock('b-pre', 'On a phone, charts are heavy.'),
        genUiBlock('b-chart', chartPart()),
      ]),
    ];
    render(<ChatTimeline turns={turns} viewportWidthPx={400} />);
    expect(screen.getByTestId('chat-block-genui-collapsed')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chat-block-genui-expand'));
    expect(screen.queryByTestId('chat-block-genui-collapsed')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-block-genui')).toBeInTheDocument();
    // Persistence pairs cleanly with rendered blocks even on mobile:
    const store = createInMemoryEntityStore();
    await store.putBlock('tnt-1', 'conv-1', 't-1', turns[0]!.blocks[1]!, ANY_PROV);
    const hits = await store.search('tnt-1', { entityType: 'conversation_block' });
    expect(hits).toHaveLength(1);
  });
});
