import { describe, expect, it } from 'vitest';

import {
  CRITIQUE_PROMPT_TEMPLATE,
  buildReflectionNote,
  renderCritiquePrompt,
} from '../reflexion/critique.js';
import {
  completeAndReflect,
  renderReflectionLessons,
  retrieveForTask,
} from '../reflexion/loop.js';
import {
  cosineSimilarity,
  createInMemoryReflectionStore,
} from '../reflexion/store.js';
import type { Embedding } from '../types.js';

function fakeEmbedder(text: string): Embedding {
  // Deterministic 8-d projection — char-bucket counts.
  const dims = new Array<number>(8).fill(0);
  for (const ch of text.toLowerCase()) {
    const idx = ch.charCodeAt(0) % 8;
    dims[idx] = (dims[idx] ?? 0) + 1;
  }
  const norm = Math.sqrt(dims.reduce((a, b) => a + b * b, 0)) || 1;
  return Object.freeze(dims.map((d) => d / norm));
}

const criticStub = (prompt: string, ctx: { taskType: string }) => ({
  critique: `On task ${ctx.taskType}: I rushed step 2 and skipped the verification call.`,
  lesson: `For ${ctx.taskType} tasks, always verify before persisting.`,
});

describe('Reflexion outer loop — Shinn et al., 2023', () => {
  it('CRITIQUE_PROMPT_TEMPLATE contains the three labelled questions', () => {
    expect(CRITIQUE_PROMPT_TEMPLATE).toContain('[1]');
    expect(CRITIQUE_PROMPT_TEMPLATE).toContain('[2]');
    expect(CRITIQUE_PROMPT_TEMPLATE).toContain('[3]');
  });

  it('renderCritiquePrompt fills task type + outcome', () => {
    const p = renderCritiquePrompt({
      taskType: 'rent_reconcile',
      taskInput: 'reconcile July 2026',
      outcome: 'failure',
      trace: 'tried, failed',
      error: 'fx_rate_unavailable',
    });
    expect(p).toContain('rent_reconcile');
    expect(p).toContain('reconcile July 2026');
    expect(p).toContain('failure');
    expect(p).toContain('fx_rate_unavailable');
  });

  it('renderCritiquePrompt handles missing error', () => {
    const p = renderCritiquePrompt({
      taskType: 'late_notice',
      taskInput: 'tenant-5',
      outcome: 'success',
      trace: 'sent',
    });
    expect(p).toContain('Error: (none)');
  });

  it('buildReflectionNote produces a validated note', async () => {
    const note = await buildReflectionNote(
      { critiqueProvider: criticStub, embedder: fakeEmbedder },
      {
        taskType: 'maintenance_triage',
        taskInput: 'plumbing leak',
        outcome: 'partial',
        trace: 'dispatched, but missed severity classification',
      },
    );
    expect(note.taskType).toBe('maintenance_triage');
    expect(note.lesson).toContain('verify');
    expect(note.embedding.length).toBeGreaterThan(0);
  });

  it('rejects empty critique', async () => {
    await expect(
      buildReflectionNote(
        {
          critiqueProvider: () => ({ critique: '', lesson: 'x' }),
          embedder: fakeEmbedder,
        },
        {
          taskType: 't',
          taskInput: 'i',
          outcome: 'failure',
          trace: '',
        },
      ),
    ).rejects.toThrow(/empty critique/);
  });

  it('rejects empty lesson', async () => {
    await expect(
      buildReflectionNote(
        {
          critiqueProvider: () => ({ critique: 'x', lesson: '   ' }),
          embedder: fakeEmbedder,
        },
        {
          taskType: 't',
          taskInput: 'i',
          outcome: 'failure',
          trace: '',
        },
      ),
    ).rejects.toThrow(/empty lesson/);
  });

  it('completeAndReflect persists note to store', async () => {
    const store = createInMemoryReflectionStore();
    await completeAndReflect(
      { critiqueProvider: criticStub, embedder: fakeEmbedder, store },
      {
        taskType: 'rent_reconcile',
        taskInput: 'Jul-2026',
        outcome: 'failure',
        trace: '...',
      },
    );
    expect(store.size()).toBe(1);
  });

  it('retrieveForTask returns top-3 similar notes by default', async () => {
    const store = createInMemoryReflectionStore();
    for (let i = 0; i < 5; i += 1) {
      await completeAndReflect(
        { critiqueProvider: criticStub, embedder: fakeEmbedder, store },
        {
          taskType: 'rent_reconcile',
          taskInput: `iteration ${i}`,
          outcome: 'failure',
          trace: 'x',
        },
      );
    }
    const result = await retrieveForTask(
      { store, embedder: fakeEmbedder },
      { taskType: 'rent_reconcile', taskInput: 'new run' },
    );
    expect(result.notes.length).toBe(3);
  });

  it('retrieveForTask filters by taskType', async () => {
    const store = createInMemoryReflectionStore();
    await completeAndReflect(
      { critiqueProvider: criticStub, embedder: fakeEmbedder, store },
      {
        taskType: 'rent_reconcile',
        taskInput: 'x',
        outcome: 'failure',
        trace: 'x',
      },
    );
    await completeAndReflect(
      { critiqueProvider: criticStub, embedder: fakeEmbedder, store },
      {
        taskType: 'late_notice',
        taskInput: 'y',
        outcome: 'failure',
        trace: 'y',
      },
    );
    const r = await retrieveForTask(
      { store, embedder: fakeEmbedder },
      { taskType: 'rent_reconcile', taskInput: 'new' },
    );
    expect(r.notes.every((n) => n.taskType === 'rent_reconcile')).toBe(true);
  });

  it('renderReflectionLessons emits bulletted lessons', async () => {
    const store = createInMemoryReflectionStore();
    await completeAndReflect(
      { critiqueProvider: criticStub, embedder: fakeEmbedder, store },
      {
        taskType: 'rent_reconcile',
        taskInput: 'x',
        outcome: 'failure',
        trace: 'x',
      },
    );
    const r = await retrieveForTask(
      { store, embedder: fakeEmbedder },
      { taskType: 'rent_reconcile', taskInput: 'new' },
    );
    const md = renderReflectionLessons(r.notes);
    expect(md).toContain('Lessons from prior attempts');
    expect(md).toContain('1.');
  });

  it('renderReflectionLessons returns empty string for no notes', () => {
    expect(renderReflectionLessons([])).toBe('');
  });

  it('cosineSimilarity returns 1 for identical vectors', () => {
    const v = fakeEmbedder('abc');
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('cosineSimilarity returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('cosineSimilarity handles mismatched dimensions', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0])).toBe(0);
  });
});
