/**
 * Stage 06 — consolidate unit tests.
 *
 * Coverage:
 *   1. no consolidator wired → zero report, no throw
 *   2. invoked once per unique tenant
 *   3. tenant failure isolated; others continue
 */

import { describe, it, expect, vi } from 'vitest';
import {
  runConsolidateStage,
  type EntityConsolidatorPort,
} from '../../stages/06-consolidate.js';
import type { StageLogger } from '../../stages/types.js';

function makeLogger(): StageLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function makePort(opts: { failFor?: string } = {}): {
  port: EntityConsolidatorPort;
  calls: Array<{ tenantId: string | null }>;
} {
  const calls: Array<{ tenantId: string | null }> = [];
  const port: EntityConsolidatorPort = {
    async consolidateForTenant(args) {
      calls.push({ tenantId: args.tenantId });
      if (opts.failFor !== undefined && args.tenantId === opts.failFor) {
        throw new Error('boom');
      }
      return {
        tenantId: args.tenantId,
        mergedEntities: 2,
        inspectedEntities: 10,
      };
    },
  };
  return { port, calls };
}

describe('runConsolidateStage', () => {
  it('is a no-op when no consolidator wired', async () => {
    const out = await runConsolidateStage({
      tenantIds: ['t-1'],
      logger: makeLogger(),
    });
    expect(out.entitiesMerged).toBe(0);
  });

  it('invokes per unique tenant', async () => {
    const { port, calls } = makePort();
    const out = await runConsolidateStage({
      tenantIds: ['t-1', 't-1', 't-2'],
      consolidator: port,
      logger: makeLogger(),
    });
    expect(calls).toHaveLength(2);
    expect(out.entitiesMerged).toBe(4);
  });

  it('continues after one tenant fails', async () => {
    const { port } = makePort({ failFor: 't-bad' });
    const out = await runConsolidateStage({
      tenantIds: ['t-bad', 't-good'],
      consolidator: port,
      logger: makeLogger(),
    });
    expect(out.entitiesMerged).toBe(2);
  });
});
