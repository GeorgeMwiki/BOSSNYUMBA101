import { describe, expect, it } from 'vitest';
import * as mtu from '../index.js';

describe('@bossnyumba/max-tool-use — public surface', () => {
  it('exports all module namespaces', () => {
    expect(typeof mtu.ptc).toBe('object');
    expect(typeof mtu.batchApi).toBe('object');
    expect(typeof mtu.filesCitations).toBe('object');
    expect(typeof mtu.computerUse).toBe('object');
    expect(typeof mtu.webResearch).toBe('object');
    expect(typeof mtu.memory).toBe('object');
    expect(typeof mtu.mcpConnectors).toBe('object');
    expect(typeof mtu.cacheControl).toBe('object');
  });

  it('exports all top-level convenience entrypoints', () => {
    expect(typeof mtu.runPTCSession).toBe('function');
    expect(typeof mtu.submitBatch).toBe('function');
    expect(typeof mtu.pollBatch).toBe('function');
    expect(typeof mtu.uploadFile).toBe('function');
    expect(typeof mtu.analyzeWithCitations).toBe('function');
    expect(typeof mtu.runComputerUseSession).toBe('function');
    expect(typeof mtu.composedResearch).toBe('function');
    expect(typeof mtu.createMemoryAdapter).toBe('function');
    expect(typeof mtu.createConnectorRegistry).toBe('function');
    expect(typeof mtu.createHealthProber).toBe('function');
    expect(typeof mtu.wrapStablePrefix).toBe('function');
    expect(typeof mtu.wrapStablePrefixes).toBe('function');
    expect(typeof mtu.betasForCacheTtl).toBe('function');
    expect(typeof mtu.summariseCacheUtilization).toBe('function');
  });

  it('exports DEFAULT_TTL_SECONDS = 3600', () => {
    expect(mtu.DEFAULT_TTL_SECONDS).toBe(3600);
  });

  it('exports the 1h opt-in snippet string', () => {
    expect(typeof mtu.ONE_HOUR_OPT_IN_SNIPPET).toBe('string');
    expect(mtu.ONE_HOUR_OPT_IN_SNIPPET.length).toBeGreaterThan(0);
  });

  it('top-level runPTCSession works as a one-liner', async () => {
    const r = await mtu.runPTCSession({
      task: 'top-level call',
      tools: [{ name: 'noop', invoke: async () => ({}) }],
      model: 'claude-opus-4-7',
      ctx: {
        tenantId: 'tnt-x',
        principalId: 'p',
        correlationId: 'c',
      },
    });
    expect(r.ok).toBe(true);
  });

  it('top-level submitBatch + pollBatch happy path', async () => {
    const h = await mtu.submitBatch({
      requests: [
        {
          customId: 'k-1',
          model: 'claude-haiku-4-5',
          messages: [{ role: 'user', content: 'x' }],
          maxTokens: 16,
        },
      ],
      model: 'claude-haiku-4-5',
    });
    const r = await mtu.pollBatch(h);
    expect(r.results).toHaveLength(1);
  });
});
