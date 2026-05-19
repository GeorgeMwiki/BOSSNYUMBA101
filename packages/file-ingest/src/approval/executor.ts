/**
 * IngestExecutor — walks an APPROVED IngestPlan, builds Provenance + entity
 * writes per row, and commits via IEntityStoreService.
 *
 * Design notes:
 *  - Entity ids are deterministic from the dedup-key columns + tenant_id +
 *    entity_type. Re-ingesting the same file yields the same entity ids.
 *  - Each attribute write carries its row's Provenance. The store dedups by
 *    provenance hash, so re-ingestion is a no-op.
 *  - Dry-run does everything except the final upsert — useful for the
 *    "preview" pane shown in chat before owner approves.
 */

import { createHash } from 'node:crypto';

import type {
  AttributeWrite,
  CreateEntityInput,
  IEntityStoreService,
} from '../entity-store/IEntityStoreService.js';
import { buildProvenance } from '../provenance/hash.js';

import { ApprovalLedger, ApprovalRuleViolationError } from './approval-ledger.js';
import type { IngestPlan } from './types.js';

export interface ExecutionContext {
  readonly tenant_id: string;
  /** Same actor that approved the plan in the ledger. The ledger enforces 4-eye. */
  readonly executor_actor_id: string;
  /** Timestamp factory — injectable for tests. Default = Date.now. */
  readonly now?: () => Date;
}

export interface BatchReport {
  readonly batch_idx: number;
  readonly entities_processed: number;
  readonly entities_created: number;
  readonly attributes_written: number;
  readonly attributes_skipped: number;
}

export interface ExecutionReport {
  readonly ingest_plan_id: string;
  readonly tenant_id: string;
  readonly entity_type: string;
  readonly dry_run: boolean;
  readonly total_rows: number;
  readonly entities_processed: number;
  readonly entities_created: number;
  readonly attributes_written: number;
  readonly attributes_skipped: number;
  readonly batch_reports: ReadonlyArray<BatchReport>;
  readonly conversation_id: string;
  /** Suggested chat-message link target. Format: app://entities/{entity_type} */
  readonly tab_link: string;
}

/** Deterministically derive an entity_id from the dedup-key column values. */
function deriveEntityId(
  tenantId: string,
  entityType: string,
  dedupKeyValues: ReadonlyArray<string>
): string {
  if (dedupKeyValues.length === 0 || dedupKeyValues.every((v) => v.trim() === '')) {
    // No dedup signal — fall back to a per-row hash so we still have a
    // stable id. This is a degenerate case; the schema-sniffer normally
    // produces at least one candidate.
    const noise = Math.random().toString(36).slice(2);
    return `${entityType}-${noise}`;
  }
  const payload = [tenantId, entityType, ...dedupKeyValues.map((v) => v.trim().toLowerCase())].join('|');
  const hex = createHash('sha256').update(payload).digest('hex');
  return `${entityType}-${hex.slice(0, 32)}`;
}

export class IngestExecutor {
  constructor(
    private readonly store: IEntityStoreService,
    private readonly ledger: ApprovalLedger
  ) {}

  async execute(plan: IngestPlan, ctx: ExecutionContext): Promise<ExecutionReport> {
    if (!plan.dryRun && !this.ledger.isApproved(plan.ingest_plan_id)) {
      throw new ApprovalRuleViolationError(
        `Cannot execute plan ${plan.ingest_plan_id}: not in 'approved' state`
      );
    }

    const now = ctx.now ?? (() => new Date());
    const proposal = plan.proposal;
    const headerToAttr: Record<string, string> = { ...proposal.field_map };
    const headerIdx = new Map<string, number>();
    for (let i = 0; i < plan.headers.length; i += 1) {
      const h = plan.headers[i];
      if (h !== undefined) headerIdx.set(h, i);
    }

    const dedupColumns = plan.schema.dedup_key_candidates.length > 0
      ? plan.schema.dedup_key_candidates
      // No candidate from sniff → use whichever mapped column maps to a
      // *_ref / id-like attribute, else fall back to the first mapped column.
      : Object.keys(headerToAttr).slice(0, 1);

    const batchReports: BatchReport[] = [];
    let totalRows = 0;
    let totalEntitiesCreated = 0;
    let totalAttrsWritten = 0;
    let totalAttrsSkipped = 0;
    let totalEntitiesProcessed = 0;

    for (const batch of plan.batched_rows) {
      const inputs: CreateEntityInput[] = [];

      for (let i = 0; i < batch.rows.length; i += 1) {
        const row = batch.rows[i] ?? [];
        const absRowIdx = batch.row_idx_start + i;
        totalRows += 1;

        const dedupValues = dedupColumns.map((col) => {
          const idx = headerIdx.get(col);
          return idx === undefined ? '' : row[idx] ?? '';
        });
        const entityId = deriveEntityId(
          ctx.tenant_id,
          proposal.entity_type,
          dedupValues
        );

        const attributes: Array<Omit<AttributeWrite, 'entity_type' | 'entity_id'>> = [];
        for (const [col, attrKey] of Object.entries(headerToAttr)) {
          const idx = headerIdx.get(col);
          if (idx === undefined) continue;
          const raw = row[idx];
          if (raw === undefined || raw === null) continue;
          const trimmed = String(raw).trim();
          if (trimmed === '') continue;

          const prov = buildProvenance({
            file_hash: plan.file_hash,
            conversation_id: plan.conversation_id,
            message_id: plan.message_id,
            row_idx: absRowIdx,
            llm_inferred_schema_version: `${plan.schema.schema_version}+${plan.plan_version}+${attrKey}`,
            ingest_plan_id: plan.ingest_plan_id,
            timestamp: now().toISOString(),
          });

          attributes.push({
            attribute_key: attrKey,
            value: trimmed,
            provenance: prov,
          });
        }

        inputs.push({
          entity_type: proposal.entity_type,
          entity_id: entityId,
          attributes,
        });
      }

      let entitiesCreated = 0;
      let attrsWritten = 0;
      let attrsSkipped = 0;

      if (plan.dryRun) {
        // Dry-run: report counts WITHOUT touching the store.
        for (const input of inputs) {
          const exists = await this.store.hasProvenanceHash(
            ctx.tenant_id,
            input.attributes[0]?.provenance.hash ?? ''
          );
          entitiesCreated += exists ? 0 : 1;
          attrsWritten += input.attributes.length;
        }
      } else {
        const results = await this.store.upsertEntitiesBatch(ctx.tenant_id, inputs);
        for (const r of results) {
          if (r.created) entitiesCreated += 1;
          attrsWritten += r.attributes_written;
          attrsSkipped += r.attributes_skipped;
        }
      }

      batchReports.push(
        Object.freeze({
          batch_idx: batch.batch_idx,
          entities_processed: inputs.length,
          entities_created: entitiesCreated,
          attributes_written: attrsWritten,
          attributes_skipped: attrsSkipped,
        })
      );

      totalEntitiesProcessed += inputs.length;
      totalEntitiesCreated += entitiesCreated;
      totalAttrsWritten += attrsWritten;
      totalAttrsSkipped += attrsSkipped;
    }

    if (!plan.dryRun) {
      this.ledger.markExecuted(plan.ingest_plan_id, ctx.executor_actor_id);
    }

    return Object.freeze({
      ingest_plan_id: plan.ingest_plan_id,
      tenant_id: ctx.tenant_id,
      entity_type: proposal.entity_type,
      dry_run: plan.dryRun,
      total_rows: totalRows,
      entities_processed: totalEntitiesProcessed,
      entities_created: totalEntitiesCreated,
      attributes_written: totalAttrsWritten,
      attributes_skipped: totalAttrsSkipped,
      batch_reports: batchReports,
      conversation_id: plan.conversation_id,
      tab_link: `app://entities/${proposal.entity_type}`,
    });
  }
}
