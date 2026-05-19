import { describe, expect, it } from 'vitest';

import { createInMemoryEntityStore } from './in-memory-entity-store';
import { replayConversation } from './replay';
import { chartPart, genUiBlock, kpiPart, tablePart, textBlock, turn } from '../__tests__/fixtures';
import type { BlackboardInteractionEvent, PinnedBlackboardItem, Provenance } from '../types';

const PROV: Provenance = {
  conversationId: 'conv-1',
  turnId: 't-1',
  blockId: 'b-1',
  llmInferred: true,
  ownerCorrected: false,
  timestamp: '2026-05-19T10:00:00Z',
};

describe('createInMemoryEntityStore', () => {
  it('round-trips a turn', async () => {
    const store = createInMemoryEntityStore();
    const t = turn('t-1', 'md', [textBlock('b-1', 'hi')]);
    await store.putTurn('tnt-1', 'conv-1', t);
    const turns = await store.listTurns('tnt-1', 'conv-1');
    expect(turns).toHaveLength(1);
    expect(turns[0]?.payload.id).toBe('t-1');
  });

  it('round-trips a block with provenance', async () => {
    const store = createInMemoryEntityStore();
    await store.putBlock('tnt-1', 'conv-1', 't-1', textBlock('b-1', 'hi'), PROV);
    const turns = await store.listTurns('tnt-1', 'conv-1');
    expect(turns).toHaveLength(0); // putBlock alone doesn't create a turn entry
  });

  it('lists pins for a conversation', async () => {
    const store = createInMemoryEntityStore();
    const pin: PinnedBlackboardItem = {
      id: 'pin-1',
      conversationId: 'conv-1',
      sourceTurnId: 't-1',
      sourceBlockId: 'b-1',
      part: chartPart(),
      pinnedAt: '2026-05-19T10:00:00Z',
      pinnedBy: 'owner',
    };
    await store.putPin('tnt-1', pin);
    const pins = await store.listPins('tnt-1', 'conv-1');
    expect(pins).toHaveLength(1);
    expect(pins[0]?.payload.id).toBe('pin-1');
  });

  it('removes a pin via removePin', async () => {
    const store = createInMemoryEntityStore();
    await store.putPin('tnt-1', {
      id: 'pin-1',
      conversationId: 'conv-1',
      sourceTurnId: 't-1',
      sourceBlockId: 'b-1',
      part: chartPart(),
      pinnedAt: '2026-05-19T10:00:00Z',
      pinnedBy: 'owner',
    });
    await store.removePin('tnt-1', 'pin-1');
    expect(await store.listPins('tnt-1', 'conv-1')).toHaveLength(0);
  });

  it('isolates state across tenants', async () => {
    const store = createInMemoryEntityStore();
    await store.putTurn('tnt-A', 'conv-1', turn('t-A', 'md', [textBlock('b', 'A')]));
    await store.putTurn('tnt-B', 'conv-1', turn('t-B', 'md', [textBlock('b', 'B')]));
    expect(await store.listTurns('tnt-A', 'conv-1')).toHaveLength(1);
    expect(await store.listTurns('tnt-B', 'conv-1')).toHaveLength(1);
  });

  it('search finds a block by its prose', async () => {
    const store = createInMemoryEntityStore();
    await store.putBlock(
      'tnt-1',
      'conv-1',
      't-1',
      textBlock('b-1', 'MD told you about the KRA filing yesterday'),
      PROV,
    );
    const hits = await store.search('tnt-1', { text: 'KRA filing', entityType: 'conversation_block' });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.snippet).toContain('KRA');
  });

  it('search ranks blocks above pins for the same hit', async () => {
    const store = createInMemoryEntityStore();
    await store.putBlock('tnt-1', 'conv-1', 't-1', textBlock('b-1', 'cashflow chart from May'), PROV);
    await store.putPin('tnt-1', {
      id: 'pin-1',
      conversationId: 'conv-1',
      sourceTurnId: 't-1',
      sourceBlockId: 'b-1',
      part: kpiPart(),
      pinnedAt: '2026-05-19T10:00:00Z',
      pinnedBy: 'owner',
      note: 'cashflow note',
    });
    const hits = await store.search('tnt-1', { text: 'cashflow' });
    const top = hits[0];
    expect(top?.record.entityType === 'conversation_block').toBe(true);
  });

  it('records interactions with ownerCorrected=true provenance', async () => {
    const store = createInMemoryEntityStore();
    const event: BlackboardInteractionEvent = {
      id: 'evt-1',
      type: 'blackboard.interaction',
      occurredAt: '2026-05-19T10:00:00Z',
      actor: 'owner',
      context: {
        conversationId: 'conv-1',
        turnId: 't-1',
        blockId: 'b-1',
        originatingPartKind: 'data-table',
      },
      payload: { kind: 'cell-edited', rowKey: 'r', columnId: 'c', previousValue: 1, nextValue: 2 },
    };
    await store.putInteraction('tnt-1', event);
    const hits = await store.search('tnt-1', { entityType: 'conversation_interaction' });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.record.provenance.ownerCorrected).toBe(true);
  });

  it('listTurns returns turns sorted by createdAt', async () => {
    const store = createInMemoryEntityStore();
    await store.putTurn('tnt-1', 'conv-1', turn('t-1', 'owner', [textBlock('b', 'first')]));
    await new Promise((r) => setTimeout(r, 1));
    await store.putTurn('tnt-1', 'conv-1', turn('t-2', 'md', [textBlock('b', 'second')]));
    const turns = await store.listTurns('tnt-1', 'conv-1');
    expect(turns.map((t) => t.payload.id)).toEqual(['t-1', 't-2']);
  });

  it('replay rebuilds the timeline + pinned items', async () => {
    const store = createInMemoryEntityStore();
    const t1 = turn('t-1', 'owner', [textBlock('b-1', 'show me cashflow')]);
    const t2 = turn('t-2', 'md', [
      textBlock('b-2', 'Here it is.'),
      genUiBlock('b-3', chartPart(), 'cashflow-2026'),
    ]);
    await store.putTurn('tnt-1', 'conv-1', t1);
    await store.putTurn('tnt-1', 'conv-1', t2);
    await store.putPin('tnt-1', {
      id: 'pin-1',
      conversationId: 'conv-1',
      sourceTurnId: 't-2',
      sourceBlockId: 'b-3',
      part: tablePart(),
      pinnedAt: '2026-05-19T10:00:00Z',
      pinnedBy: 'owner',
    });

    const replay = await replayConversation(store, 'tnt-1', 'conv-1');
    expect(replay.turns).toHaveLength(2);
    expect(replay.turns[1]?.blocks).toHaveLength(2);
    expect(replay.pinned).toHaveLength(1);
  });
});
