/**
 * Message Batches API driver.
 *
 * `submitBatch({requests}): BatchHandle` + `pollBatch(handle): BatchResult`
 *
 * Cost-aware: combines Batch (50% off) + Caching (90% off cached input)
 * to land at ~95% off baseline for cache-heavy workloads.
 *
 * Use cases (per L2 audit §6.2):
 *   - Monthly KRA filings (10k tenants/month)
 *   - Bulk tenant comms
 *   - Quarterly compliance audits
 *   - Annual statements (50k/year)
 *
 * SLA: ≤24h, most batches < 1h. Latency p95 < 2h for 1000-request batches.
 */

import type {
  BatchHandle,
  BatchRequest,
  BatchResult,
  ClaudeModelId,
} from '../types.js';
import { calculateStackedCost } from './cost-stacking.js';

const CUSTOM_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_REQUESTS_PER_BATCH = 100_000;
const MAX_BATCH_BYTES = 256 * 1024 * 1024;

export interface BatchDriverDeps {
  /** Optional SDK call for submitting batch — uses synthetic backend if undefined. */
  readonly anthropicBatchCreate?: (
    requests: ReadonlyArray<BatchRequest>,
  ) => Promise<{ batchId: string; submittedAt: string }>;
  readonly anthropicBatchRetrieve?: (
    batchId: string,
  ) => Promise<{
    status: BatchHandle['status'];
    results?: BatchResult['results'];
  }>;
  /** Latency simulator for synthetic backend. */
  readonly clock?: () => number;
  readonly randomId?: () => string;
}

export interface BatchSubmitInput {
  readonly requests: ReadonlyArray<BatchRequest>;
  readonly model: ClaudeModelId;
}

export function createBatchDriver(deps: BatchDriverDeps = {}) {
  const now = deps.clock ?? (() => Date.now());
  const randomId = deps.randomId ?? defaultRandomId;

  const inFlight = new Map<string, {
    submittedAt: number;
    requests: ReadonlyArray<BatchRequest>;
    model: ClaudeModelId;
  }>();

  return {
    async submitBatch(input: BatchSubmitInput): Promise<BatchHandle> {
      validateBatchRequests(input.requests);

      if (deps.anthropicBatchCreate) {
        const r = await deps.anthropicBatchCreate(input.requests);
        return {
          batchId: r.batchId,
          status: 'queued',
          submittedAt: r.submittedAt,
          requestCount: input.requests.length,
          model: input.model,
        };
      }

      const batchId = `batch_${randomId()}`;
      const submittedAt = new Date(now()).toISOString();
      inFlight.set(batchId, {
        submittedAt: now(),
        requests: input.requests,
        model: input.model,
      });
      return {
        batchId,
        status: 'queued',
        submittedAt,
        requestCount: input.requests.length,
        model: input.model,
      };
    },

    async pollBatch(handle: BatchHandle): Promise<BatchResult> {
      if (deps.anthropicBatchRetrieve) {
        const r = await deps.anthropicBatchRetrieve(handle.batchId);
        if (r.status === 'completed' && r.results) {
          const completedAt = new Date(now()).toISOString();
          return {
            batchId: handle.batchId,
            results: r.results,
            completedAt,
            latencyMs:
              now() - new Date(handle.submittedAt).getTime(),
            effectiveDiscount: effectiveDiscountFor(handle),
          };
        }
        throw new Error(`Batch ${handle.batchId} status=${r.status}`);
      }

      const meta = inFlight.get(handle.batchId);
      if (!meta) {
        throw new Error(`Unknown batch ${handle.batchId}`);
      }

      // Synthetic backend: all requests complete instantly with stub output
      const results: BatchResult['results'] = meta.requests.map((req) => ({
        customId: req.customId,
        success: true,
        content: `[synthetic-batch-output:${req.customId}]`,
      }));

      const latencyMs = now() - meta.submittedAt;
      const completedAt = new Date(now()).toISOString();

      return {
        batchId: handle.batchId,
        results,
        completedAt,
        latencyMs,
        effectiveDiscount: estimateEffectiveDiscount(meta.requests, meta.model),
      };
    },
  };
}

function validateBatchRequests(requests: ReadonlyArray<BatchRequest>): void {
  if (requests.length === 0) {
    throw new Error('Batch requires at least one request');
  }
  if (requests.length > MAX_REQUESTS_PER_BATCH) {
    throw new Error(
      `Batch exceeds ${MAX_REQUESTS_PER_BATCH} requests (got ${requests.length})`,
    );
  }
  const ids = new Set<string>();
  let approxBytes = 0;
  for (const req of requests) {
    if (!CUSTOM_ID_RE.test(req.customId)) {
      throw new Error(`Invalid custom_id "${req.customId}"`);
    }
    if (ids.has(req.customId)) {
      throw new Error(`Duplicate custom_id "${req.customId}"`);
    }
    ids.add(req.customId);
    if (req.maxTokens < 1 || req.maxTokens > 300_000) {
      throw new Error(`max_tokens out of range for ${req.customId}`);
    }
    approxBytes += approxRequestBytes(req);
  }
  if (approxBytes > MAX_BATCH_BYTES) {
    throw new Error(
      `Batch exceeds 256 MB size limit (~${approxBytes} bytes)`,
    );
  }
}

function approxRequestBytes(req: BatchRequest): number {
  const messageBytes = req.messages.reduce(
    (acc, m) => acc + m.content.length + 32,
    0,
  );
  return messageBytes + req.customId.length + 64;
}

function effectiveDiscountFor(_handle: BatchHandle): number {
  // No detailed token data from external SDK; assume baseline 50% (batch only).
  return BATCH_DEFAULT_DISCOUNT;
}

const BATCH_DEFAULT_DISCOUNT = 0.5;

function estimateEffectiveDiscount(
  requests: ReadonlyArray<BatchRequest>,
  model: ClaudeModelId,
): number {
  // Average the per-request stacked discount when caching is in play
  let totalDiscount = 0;
  for (const req of requests) {
    const inTokens = Math.ceil(
      req.messages.reduce((acc, m) => acc + m.content.length, 0) / 4,
    );
    const cachedTokens = req.cacheControl ? Math.floor(inTokens * 0.8) : 0;
    const breakdown = calculateStackedCost({
      model,
      batched: true,
      inputTokens: inTokens - cachedTokens,
      outputTokens: req.maxTokens,
      cachedInputTokens: cachedTokens,
      ...(req.cacheControl
        ? { cacheTtlSeconds: req.cacheControl.ttlSeconds }
        : {}),
    });
    totalDiscount += breakdown.effectiveDiscount;
  }
  return totalDiscount / requests.length;
}

function defaultRandomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
