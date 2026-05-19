/**
 * Message Batches API — public surface.
 *
 * 50% off baseline; stacks with prompt caching (90% off cached input)
 * to ~95% off baseline.
 *
 * Closes L2 #2.
 */

export {
  createBatchDriver,
  type BatchDriverDeps,
  type BatchSubmitInput,
} from './batch-driver.js';

export {
  calculateStackedCost,
  ON_DEMAND_PRICING,
  BATCH_MULTIPLIER,
  CACHED_INPUT_MULTIPLIER,
  CACHE_WRITE_1H_SURCHARGE,
  CACHE_WRITE_5MIN_SURCHARGE,
  type ModelOnDemandPricing,
  type StackedCostBreakdown,
  type StackedCostInput,
} from './cost-stacking.js';

import { createBatchDriver } from './batch-driver.js';
import type {
  BatchHandle,
  BatchRequest,
  BatchResult,
  ClaudeModelId,
} from '../types.js';

// Module-level default driver so the synthetic in-memory state survives
// across separate `submitBatch` / `pollBatch` calls in user code.
const DEFAULT_DRIVER = createBatchDriver();

/** Convenience top-level: submit a one-off batch with the default driver. */
export async function submitBatch(input: {
  readonly requests: ReadonlyArray<BatchRequest>;
  readonly model: ClaudeModelId;
}): Promise<BatchHandle> {
  return DEFAULT_DRIVER.submitBatch(input);
}

/** Convenience top-level: poll a one-off batch with the default driver. */
export async function pollBatch(handle: BatchHandle): Promise<BatchResult> {
  return DEFAULT_DRIVER.pollBatch(handle);
}
