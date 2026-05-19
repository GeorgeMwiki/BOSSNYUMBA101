import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineDurableFlow } from '../define.js';
import type { DurableStep } from '../../types/index.js';

const noopStep = (name: string, idem: string): DurableStep => ({
  name,
  idempotencyKey: idem,
  run: async (input: unknown) => input,
});

describe('defineDurableFlow', () => {
  it('builds a valid flow', () => {
    const flow = defineDurableFlow({
      name: 'test-flow',
      version: '1.0.0',
      steps: [noopStep('a', 'k-a'), noopStep('b', 'k-b')],
      argsSchema: z.object({ x: z.number() }),
    });
    expect(flow.name).toBe('test-flow');
    expect(flow.steps).toHaveLength(2);
  });

  it('throws when no steps are defined', () => {
    expect(() =>
      defineDurableFlow({
        name: 'empty',
        version: '1.0.0',
        steps: [],
        argsSchema: z.object({}),
      }),
    ).toThrow(/at least one step/iu);
  });

  it('throws on duplicate step names', () => {
    expect(() =>
      defineDurableFlow({
        name: 'dup',
        version: '1.0.0',
        steps: [noopStep('a', 'k-1'), noopStep('a', 'k-2')],
        argsSchema: z.object({}),
      }),
    ).toThrow(/duplicate step name/iu);
  });

  it('throws on missing idempotency key', () => {
    expect(() =>
      defineDurableFlow({
        name: 'no-idem',
        version: '1.0.0',
        steps: [noopStep('a', '')],
        argsSchema: z.object({}),
      }),
    ).toThrow(/idempotencyKey/iu);
  });

  it('passes through optional maxRunHours', () => {
    const flow = defineDurableFlow({
      name: 'with-max',
      version: '1.0.0',
      maxRunHours: 24,
      steps: [noopStep('a', 'k-a')],
      argsSchema: z.object({}),
    });
    expect(flow.maxRunHours).toBe(24);
  });
});
