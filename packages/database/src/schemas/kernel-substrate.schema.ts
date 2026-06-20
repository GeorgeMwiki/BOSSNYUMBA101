/**
 * Kernel substrate — persistence for the brain kernel's
 * sampled chain-of-thought, persona drift events, and per-think()
 * provenance records. Mirrors LITFIN's `cot_reservoir`,
 * `persona_drift_events`, and `intelligence_substrate` tables,
 * scoped to BossNyumba multi-tenancy.
 *
 * The kernel itself is storage-agnostic; production binds these
 * tables to the kernel's `CotReservoirSink`, `PersonaDriftSink`, and
 * provenance recorder at the composition root.
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  jsonb,
  timestamp,
  doublePrecision,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenant.schema.js';

export const kernelStakesEnum = pgEnum('kernel_stakes', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const kernelTierEnum = pgEnum('kernel_tier', [
  'tenant',
  'lease',
  'unit',
  'block',
  'property',
  'portfolio',
  'org',
  'industry',
]);

export const kernelScopeKindEnum = pgEnum('kernel_scope_kind', [
  'tenant',
  'platform',
]);

export const personaDriftViolationEnum = pgEnum('persona_drift_violation', [
  'taboo',
  'first-person-loss',
  'tone',
  'fabrication',
]);

export const personaDriftSeverityEnum = pgEnum('persona_drift_severity', [
  'low',
  'medium',
  'high',
]);

// ─────────────────────────────────────────────────────────────────────
// CoT reservoir — sampled chain-of-thought for audit replay.
// ─────────────────────────────────────────────────────────────────────

export const kernelCotReservoir = pgTable(
  'kernel_cot_reservoir',
  {
    thoughtId: text('thought_id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    threadId: text('thread_id').notNull(),
    stakes: kernelStakesEnum('stakes').notNull(),
    /**
     * PII-scrubbed thought text. The raw thought is sanitised before
     * persistence (phone/email/NIDA/KRA PIN/M-Pesa pattern set) and the
     * untouched prompt/response are addressable only via the hashes
     * below. Mirrors LITFIN `cot-recorder.ts:35-78`.
     */
    thoughtText: text('thought_text').notNull(),
    /** SHA-256 of the pre-scrub thought text (hex). */
    promptHash: text('prompt_hash'),
    /** SHA-256 of the sanitised text persisted in `thoughtText` (hex). */
    responseHash: text('response_hash'),
    /**
     * Opaque per-user grouping key for memory consolidation. The
     * consolidation-worker buckets reservoir rows by (tenantId, userId)
     * before emitting one semantic fact per group. NOT an access boundary —
     * `tenantId` is the RLS key; no FK so a reservoir row can outlive its
     * user. Added by migration 0325; NULL for pre-0325 rows (the
     * consolidation query skips them via `user_id IS NOT NULL`).
     */
    userId: text('user_id'),
    /**
     * Idempotency cursor for the memory-consolidation worker. NULL = not
     * yet consolidated (eligible for pickup); stamped after the semantic
     * write for the row's group succeeds. Added by migration 0325.
     */
    consolidatedAt: timestamp('consolidated_at', { withTimezone: true }),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantTimeIdx: index('idx_kernel_cot_tenant_time').on(t.tenantId, t.capturedAt),
    threadIdx: index('idx_kernel_cot_thread').on(t.threadId),
    // Partial index serving the consolidation fetch (only unconsolidated,
    // attributable rows). Mirrors migration 0325's idx_kernel_cot_unconsolidated.
    unconsolidatedIdx: index('idx_kernel_cot_unconsolidated')
      .on(t.capturedAt)
      .where(sql`consolidated_at IS NULL AND user_id IS NOT NULL`),
  }),
);

// ─────────────────────────────────────────────────────────────────────
// Persona drift events — voice consistency violations.
// ─────────────────────────────────────────────────────────────────────

export const kernelPersonaDriftEvents = pgTable(
  'kernel_persona_drift_events',
  {
    id: text('id').primaryKey(),
    thoughtId: text('thought_id').notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    personaId: text('persona_id').notNull(),
    violationType: personaDriftViolationEnum('violation_type').notNull(),
    severity: personaDriftSeverityEnum('severity').notNull(),
    excerpt: text('excerpt').notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantTimeIdx: index('idx_kernel_drift_tenant_time').on(t.tenantId, t.detectedAt),
    personaSeverityIdx: index('idx_kernel_drift_persona_severity').on(
      t.personaId,
      t.severity,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────────────
// Provenance — per-think() decision record. The kernel's hash-chain
// audit (ai_audit_chain) is unchanged; this table captures the
// kernel-specific structured fields for analytics and replay.
// ─────────────────────────────────────────────────────────────────────

export const kernelProvenance = pgTable(
  'kernel_provenance',
  {
    thoughtId: text('thought_id').primaryKey(),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    threadId: text('thread_id').notNull(),
    scopeKind: kernelScopeKindEnum('scope_kind').notNull(),
    tier: kernelTierEnum('tier').notNull(),
    stakes: kernelStakesEnum('stakes').notNull(),
    inputHash: text('input_hash').notNull(),
    outputHash: text('output_hash').notNull(),
    sensorId: text('sensor_id').notNull(),
    modelId: text('model_id').notNull(),
    cacheHit: text('cache_hit').notNull(),  // 'true'|'false' textual for replication safety
    judgeScore: doublePrecision('judge_score'),
    cohortFingerprints: jsonb('cohort_fingerprints').notNull().default([]),
    toolCallSummaries: jsonb('tool_call_summaries').notNull().default([]),
    latencyMs: doublePrecision('latency_ms').notNull(),
    producedAt: timestamp('produced_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    tenantTimeIdx: index('idx_kernel_prov_tenant_time').on(t.tenantId, t.producedAt),
    threadIdx: index('idx_kernel_prov_thread').on(t.threadId),
    sensorIdx: index('idx_kernel_prov_sensor').on(t.sensorId),
  }),
);
