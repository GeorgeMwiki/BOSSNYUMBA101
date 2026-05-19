import { describe, expect, it } from 'vitest';
import { createBatchDriver } from './batch-driver.js';
import type { BatchRequest, ClaudeModelId } from '../types.js';

function makeRequest(id: string): BatchRequest {
  return {
    customId: id,
    model: 'claude-sonnet-4-6',
    messages: [{ role: 'user', content: `monthly KRA filing for ${id}` }],
    maxTokens: 800,
  };
}

const MODEL: ClaudeModelId = 'claude-sonnet-4-6';

describe('createBatchDriver — submit/poll round trip', () => {
  it('submits a batch and returns a queued handle', async () => {
    const driver = createBatchDriver();
    const handle = await driver.submitBatch({
      requests: [makeRequest('tnt-001'), makeRequest('tnt-002')],
      model: MODEL,
    });
    expect(handle.status).toBe('queued');
    expect(handle.requestCount).toBe(2);
    expect(handle.batchId).toMatch(/^batch_/);
  });

  it('returns results when the batch is polled', async () => {
    const driver = createBatchDriver();
    const handle = await driver.submitBatch({
      requests: [makeRequest('t-1')],
      model: MODEL,
    });
    const result = await driver.pollBatch(handle);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(true);
  });

  it('preserves submitted custom_ids in the results', async () => {
    const driver = createBatchDriver();
    const ids = ['kra-001', 'kra-002', 'kra-003'];
    const handle = await driver.submitBatch({
      requests: ids.map(makeRequest),
      model: MODEL,
    });
    const result = await driver.pollBatch(handle);
    expect(result.results.map((r) => r.customId).sort()).toEqual(ids.sort());
  });

  it('rejects an empty batch', async () => {
    const driver = createBatchDriver();
    await expect(
      driver.submitBatch({ requests: [], model: MODEL }),
    ).rejects.toThrow(/at least one/i);
  });

  it('rejects a batch with duplicate custom_id', async () => {
    const driver = createBatchDriver();
    await expect(
      driver.submitBatch({
        requests: [makeRequest('dup'), makeRequest('dup')],
        model: MODEL,
      }),
    ).rejects.toThrow(/duplicate/i);
  });

  it('rejects a malformed custom_id', async () => {
    const driver = createBatchDriver();
    await expect(
      driver.submitBatch({
        requests: [
          {
            ...makeRequest('ok'),
            customId: 'has spaces',
          },
        ],
        model: MODEL,
      }),
    ).rejects.toThrow(/invalid custom_id/i);
  });

  it('rejects max_tokens beyond the 300k cap', async () => {
    const driver = createBatchDriver();
    await expect(
      driver.submitBatch({
        requests: [
          {
            customId: 'big',
            model: MODEL,
            messages: [{ role: 'user', content: 'x' }],
            maxTokens: 500_000,
          },
        ],
        model: MODEL,
      }),
    ).rejects.toThrow(/max_tokens out of range/i);
  });

  it('synthetic latency p95 < 2h for 1000 requests (synthetic backend = ~0ms)', async () => {
    const driver = createBatchDriver();
    const requests = Array.from({ length: 1000 }, (_, i) =>
      makeRequest(`t-${i.toString().padStart(4, '0')}`),
    );
    const handle = await driver.submitBatch({ requests, model: MODEL });
    const result = await driver.pollBatch(handle);
    expect(result.results).toHaveLength(1000);
    // p95 latency on synthetic backend; well under 2h (7.2M ms)
    expect(result.latencyMs).toBeLessThan(7_200_000);
  });

  it('reports an effectiveDiscount near 0.5 for non-cached batches', async () => {
    const driver = createBatchDriver();
    const handle = await driver.submitBatch({
      requests: [makeRequest('t-1'), makeRequest('t-2')],
      model: MODEL,
    });
    const result = await driver.pollBatch(handle);
    expect(result.effectiveDiscount).toBeGreaterThan(0.45);
    expect(result.effectiveDiscount).toBeLessThan(0.55);
  });

  it('reports a higher effectiveDiscount when cacheControl is supplied', async () => {
    const driver = createBatchDriver();
    const cachedReq1: BatchRequest = {
      ...makeRequest('cached-1'),
      cacheControl: { ttlSeconds: 3600 },
    };
    const cachedReq2: BatchRequest = {
      ...makeRequest('cached-2'),
      cacheControl: { ttlSeconds: 3600 },
    };
    const handle = await driver.submitBatch({
      requests: [cachedReq1, cachedReq2],
      model: MODEL,
    });
    const r = await driver.pollBatch(handle);
    expect(r.effectiveDiscount).toBeGreaterThan(0.5);
  });

  it('throws on poll of unknown batchId in synthetic backend', async () => {
    const driver = createBatchDriver();
    await expect(
      driver.pollBatch({
        batchId: 'batch_does_not_exist',
        status: 'queued',
        submittedAt: new Date().toISOString(),
        requestCount: 0,
        model: MODEL,
      }),
    ).rejects.toThrow(/unknown batch/i);
  });

  it('delegates to anthropic SDK when injected', async () => {
    const driver = createBatchDriver({
      anthropicBatchCreate: async () => ({
        batchId: 'msgbatch_sdk_123',
        submittedAt: '2026-05-19T10:00:00Z',
      }),
      anthropicBatchRetrieve: async () => ({
        status: 'completed' as const,
        results: [
          { customId: 'x', success: true, content: 'sdk-output' },
        ],
      }),
    });
    const handle = await driver.submitBatch({
      requests: [makeRequest('x')],
      model: MODEL,
    });
    expect(handle.batchId).toBe('msgbatch_sdk_123');
    const r = await driver.pollBatch(handle);
    expect(r.results[0]!.content).toBe('sdk-output');
  });
});
