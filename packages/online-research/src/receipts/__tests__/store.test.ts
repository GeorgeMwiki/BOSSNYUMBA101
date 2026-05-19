import { describe, it, expect } from 'vitest';
import { createInMemoryReceiptStore } from '../in-memory-store.js';
import type { ResearchSessionEntity } from '../../ports/index.js';

const baseEntity = (over: Partial<ResearchSessionEntity>): ResearchSessionEntity => ({
  id: 'res-1',
  type: 'research_session',
  tenantId: 'tnt_1',
  question: 'What is the KRA WHT rate?',
  subQuestions: [],
  sourcesFetched: [],
  citations: [],
  costUsd: 0.5,
  elapsedMs: 12000,
  startedAt: '2026-05-19T10:00:00Z',
  endedAt: '2026-05-19T10:00:12Z',
  initiatedBy: 'usr_1',
  status: 'completed',
  tags: [],
  ...over,
});

describe('createInMemoryReceiptStore', () => {
  it('records + finds by id', async () => {
    const store = createInMemoryReceiptStore();
    const { id } = await store.recordResearchSession(baseEntity({ id: 'res-1' }));
    expect(id).toBe('res-1');
    const found = await store.findResearchSession('res-1');
    expect(found?.question).toBe('What is the KRA WHT rate?');
  });

  it('returns null on unknown id', async () => {
    const store = createInMemoryReceiptStore();
    expect(await store.findResearchSession('unknown')).toBeNull();
  });

  it('search by text matches question', async () => {
    const store = createInMemoryReceiptStore();
    await store.recordResearchSession(baseEntity({ id: 'a', question: 'KRA WHT rate' }));
    await store.recordResearchSession(baseEntity({ id: 'b', question: 'Eviction notice law' }));
    const r = await store.searchResearchSessions({ tenantId: 'tnt_1', textQuery: 'KRA' });
    expect(r).toHaveLength(1);
    expect(r[0]?.id).toBe('a');
  });

  it('search by text matches tags', async () => {
    const store = createInMemoryReceiptStore();
    await store.recordResearchSession(
      baseEntity({ id: 'a', tags: ['vendor', 'due-diligence'] }),
    );
    await store.recordResearchSession(
      baseEntity({ id: 'b', tags: ['regulation'] }),
    );
    const r = await store.searchResearchSessions({ tenantId: 'tnt_1', textQuery: 'vendor' });
    expect(r).toHaveLength(1);
    expect(r[0]?.id).toBe('a');
  });

  it('search isolates by tenantId', async () => {
    const store = createInMemoryReceiptStore();
    await store.recordResearchSession(baseEntity({ id: 'a', tenantId: 'tnt_1' }));
    await store.recordResearchSession(baseEntity({ id: 'b', tenantId: 'tnt_2' }));
    const r = await store.searchResearchSessions({ tenantId: 'tnt_1' });
    expect(r).toHaveLength(1);
    expect(r[0]?.id).toBe('a');
  });

  it('search respects since/until bounds', async () => {
    const store = createInMemoryReceiptStore();
    await store.recordResearchSession(
      baseEntity({ id: 'a', startedAt: '2026-05-01T10:00:00Z' }),
    );
    await store.recordResearchSession(
      baseEntity({ id: 'b', startedAt: '2026-05-15T10:00:00Z' }),
    );
    const r = await store.searchResearchSessions({
      tenantId: 'tnt_1',
      since: '2026-05-10T00:00:00Z',
    });
    expect(r).toHaveLength(1);
    expect(r[0]?.id).toBe('b');
  });

  it('search sorts most-recent first', async () => {
    const store = createInMemoryReceiptStore();
    await store.recordResearchSession(
      baseEntity({ id: 'older', startedAt: '2026-05-01T10:00:00Z' }),
    );
    await store.recordResearchSession(
      baseEntity({ id: 'newer', startedAt: '2026-05-15T10:00:00Z' }),
    );
    const r = await store.searchResearchSessions({ tenantId: 'tnt_1' });
    expect(r[0]?.id).toBe('newer');
  });

  it('search respects limit', async () => {
    const store = createInMemoryReceiptStore();
    for (let i = 0; i < 30; i++) {
      await store.recordResearchSession(
        baseEntity({ id: `r-${i}`, startedAt: new Date(2026, 4, i + 1).toISOString() }),
      );
    }
    const r = await store.searchResearchSessions({ tenantId: 'tnt_1', limit: 5 });
    expect(r).toHaveLength(5);
  });
});
