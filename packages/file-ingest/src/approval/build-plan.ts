import type { BuildPlanInput, IngestPlan, RowBatch } from './types.js';

export const DEFAULT_BATCH_SIZE = 100;
export const PLAN_VERSION = 'plan-v1';

export function buildIngestPlan(input: BuildPlanInput): IngestPlan {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  if (batchSize <= 0 || !Number.isFinite(batchSize)) {
    throw new Error(`Invalid batchSize: ${input.batchSize}`);
  }

  const batches: RowBatch[] = [];
  const rows = input.table.rows;
  for (let start = 0; start < rows.length; start += batchSize) {
    const end = Math.min(start + batchSize, rows.length);
    batches.push(
      Object.freeze({
        batch_idx: batches.length,
        row_idx_start: start,
        row_idx_end: end,
        rows: rows.slice(start, end),
      })
    );
  }

  return Object.freeze({
    ingest_plan_id: input.ingest_plan_id,
    file_hash: input.file_hash,
    conversation_id: input.conversation_id,
    message_id: input.message_id,
    schema: input.schema,
    proposal: input.proposal,
    batched_rows: batches,
    headers: input.table.headers,
    dryRun: input.dryRun ?? false,
    built_at: new Date().toISOString(),
    plan_version: PLAN_VERSION,
  });
}
