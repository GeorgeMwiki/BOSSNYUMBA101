import { describe, expect, it } from 'vitest';
import { orchestrate } from '../rpa/bot-orchestrator.js';

describe('rpa: orchestrate', () => {
  it('runs independent steps in declared topological order', async () => {
    const log: string[] = [];
    const out = await orchestrate([
      { id: 'a', name: 'A', run: async () => { log.push('a'); } },
      { id: 'b', name: 'B', run: async () => { log.push('b'); } },
      { id: 'c', name: 'C', dependsOn: ['a', 'b'], run: async () => { log.push('c'); } },
    ]);
    expect(out.every((r) => r.status === 'success')).toBe(true);
    expect(log[log.length - 1]).toBe('c');
  });

  it('skips steps when a dependency fails', async () => {
    const out = await orchestrate([
      {
        id: 'fail',
        name: 'Fail',
        run: async () => { throw new Error('boom'); },
        maxAttempts: 1,
      },
      { id: 'b', name: 'B', dependsOn: ['fail'], run: async () => undefined },
    ]);
    expect(out.find((r) => r.stepId === 'fail')?.status).toBe('failure');
    expect(out.find((r) => r.stepId === 'b')?.status).toBe('skipped');
  });

  it('retries up to maxAttempts then marks failure', async () => {
    let calls = 0;
    const out = await orchestrate([
      {
        id: 'retry',
        name: 'Retry',
        run: async () => {
          calls += 1;
          throw new Error('nope');
        },
        maxAttempts: 3,
      },
    ]);
    expect(calls).toBe(3);
    expect(out[0].status).toBe('failure');
    expect(out[0].attempts).toBe(3);
  });

  it('honours idempotency key (already-completed)', async () => {
    const log: string[] = [];
    const out = await orchestrate(
      [
        {
          id: 's',
          name: 'S',
          idempotencyKey: 'rent-2026-06-t1',
          run: async () => { log.push('s'); },
        },
      ],
      { completedIdempotencyKeys: ['rent-2026-06-t1'] },
    );
    expect(out[0].status).toBe('success');
    expect(log).toEqual([]);
  });

  it('throws on cyclic dependencies', async () => {
    await expect(
      orchestrate([
        { id: 'a', name: 'A', dependsOn: ['b'], run: async () => undefined },
        { id: 'b', name: 'B', dependsOn: ['a'], run: async () => undefined },
      ]),
    ).rejects.toThrow(/cycle/);
  });

  it('throws on missing dependency', async () => {
    await expect(
      orchestrate([
        { id: 'a', name: 'A', dependsOn: ['ghost'], run: async () => undefined },
      ]),
    ).rejects.toThrow(/missing step/);
  });

  it('caps step retries at globalMaxAttempts', async () => {
    let calls = 0;
    const out = await orchestrate(
      [
        {
          id: 's',
          name: 'S',
          maxAttempts: 99,
          run: async () => {
            calls += 1;
            throw new Error('nope');
          },
        },
      ],
      { globalMaxAttempts: 2 },
    );
    expect(calls).toBe(2);
    expect(out[0].attempts).toBe(2);
  });
});
