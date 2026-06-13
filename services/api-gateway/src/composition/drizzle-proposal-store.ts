/**
 * Drizzle-backed dispatch-router persistence stores — Piece L brain↔tab loop.
 *
 * The dispatcher (`@bossnyumba/dispatch-router`) writes its capture +
 * proposal + event + audit output through four small port interfaces so
 * the package keeps no hard dep on `@bossnyumba/database`. In dev / CI
 * those ports default to the in-memory implementations shipped by the
 * package; in production they MUST persist to Postgres so that:
 *
 *   - a proposal the brain emits survives a process restart, and
 *   - the HITL approve/decline/edit routes (`routes/proposals.hono.ts`)
 *     read + transition the SAME rows the dispatcher wrote.
 *
 * This module provides the Drizzle adapters for all four ports:
 *
 *   - ConversationCaptureStore → `conversation_capture`  (migration 0229)
 *   - ModuleUpdateProposalStore → `module_update_proposals` (migration 0230)
 *   - TabEventLogStore          → `tab_event_log`         (migration 0232)
 *   - AuditChainSink            → `ai_audit_chain`        (migration 0037)
 *
 * Pattern mirrors `ai-audit-chain-repo.ts` in this directory: a duck-typed
 * `db.execute(sql\`...\`)` client, parameterised SQL (no string interp),
 * and a `rowsOf()` unwrapper that tolerates both the postgres-js array
 * shape and the `{ rows }` shape.
 *
 * Tenant isolation: every WHERE clause carries `tenant_id = ${...}`. RLS
 * on the tables (migrations 0229/0230/0232) is the belt-and-braces layer.
 */

import { sql } from 'drizzle-orm';
import {
  buildChainLink,
  type AuditChainLink,
  type AuditChainSink,
  type ConversationCapture,
  type ConversationCaptureStore,
  type ModuleUpdateProposal,
  type ModuleUpdateProposalStore,
  type ProposalStatus,
  type Priority,
  type ResolvedEntity,
  type TabEventLogEntry,
  type TabEventLogStore,
} from '@bossnyumba/dispatch-router';

// ─── DB client duck-type ───────────────────────────────────────────────

/**
 * Minimal Drizzle client surface used here. Tagged structurally (not via
 * the database package's `DatabaseClient`) to avoid the namespace-vs-type
 * ambiguity that trips the api-gateway tsconfig — same convention as the
 * neighbouring `ai-audit-chain-repo.ts` and `audit-sink-drizzle-adapter.ts`.
 */
interface DrizzleLikeClient {
  execute(q: unknown): Promise<unknown>;
}

function rowsOf(result: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const rows = (result as { rows?: unknown }).rows;
  if (Array.isArray(rows)) {
    return rows as ReadonlyArray<Record<string, unknown>>;
  }
  return [];
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ─── ConversationCaptureStore (conversation_capture) ───────────────────

function rowToCapture(row: Record<string, unknown>): ConversationCapture {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    thread_id: (row.thread_id as string | null) ?? null,
    message_id: (row.message_id as string | null) ?? null,
    persona_id: String(row.persona_id),
    user_id: (row.user_id as string | null) ?? null,
    user_text: String(row.user_text ?? ''),
    assistant_text: String(row.assistant_text ?? ''),
    decision_kind: row.decision_kind as ConversationCapture['decision_kind'],
    entities: (row.entities as ResolvedEntity[] | null) ?? [],
    intent: row.intent as ConversationCapture['intent'],
    intent_confidence: toNumber(row.intent_confidence),
    capture_confidence: toNumber(row.capture_confidence),
    persona_trust: toNumber(row.persona_trust),
    tenant_trust: toNumber(row.tenant_trust),
    attributes: (row.attributes as Record<string, unknown> | null) ?? {},
    exchange_hash: String(row.exchange_hash ?? ''),
    latency_ms: toNumber(row.latency_ms),
    created_at: toIso(row.created_at),
  };
}

export function createDrizzleCaptureStore(
  db: DrizzleLikeClient,
): ConversationCaptureStore {
  return {
    async insert(row) {
      await db.execute(sql`
        INSERT INTO conversation_capture (
          id, tenant_id, thread_id, message_id, persona_id, user_id,
          user_text, assistant_text, decision_kind, entities, intent,
          intent_confidence, capture_confidence, persona_trust,
          tenant_trust, attributes, exchange_hash, latency_ms, created_at
        ) VALUES (
          ${row.id}, ${row.tenant_id}, ${row.thread_id}, ${row.message_id},
          ${row.persona_id}, ${row.user_id}, ${row.user_text},
          ${row.assistant_text}, ${row.decision_kind},
          ${JSON.stringify(row.entities ?? [])}::jsonb, ${row.intent},
          ${row.intent_confidence}, ${row.capture_confidence},
          ${row.persona_trust}, ${row.tenant_trust},
          ${JSON.stringify(row.attributes ?? {})}::jsonb,
          ${row.exchange_hash}, ${row.latency_ms}, ${row.created_at}
        )
        ON CONFLICT (id) DO NOTHING
      `);
    },
    async findById(tenant_id, id) {
      const result = await db.execute(sql`
        SELECT * FROM conversation_capture
        WHERE tenant_id = ${tenant_id} AND id = ${id}
        LIMIT 1
      `);
      const rows = rowsOf(result);
      return rows.length > 0 ? rowToCapture(rows[0]) : null;
    },
    async findByHash(tenant_id, hash) {
      const result = await db.execute(sql`
        SELECT * FROM conversation_capture
        WHERE tenant_id = ${tenant_id} AND exchange_hash = ${hash}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const rows = rowsOf(result);
      return rows.length > 0 ? rowToCapture(rows[0]) : null;
    },
    async listByTenant(tenant_id, limit) {
      const cap = limit ?? 100;
      const result = await db.execute(sql`
        SELECT * FROM conversation_capture
        WHERE tenant_id = ${tenant_id}
        ORDER BY created_at DESC
        LIMIT ${cap}
      `);
      return rowsOf(result).map(rowToCapture);
    },
  };
}

// ─── ModuleUpdateProposalStore (module_update_proposals) ───────────────

function rowToProposal(row: Record<string, unknown>): ModuleUpdateProposal {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    capture_id: String(row.capture_id),
    module_template_id: String(row.module_template_id),
    action: String(row.action),
    persona_id: String(row.persona_id),
    status: row.status as ProposalStatus,
    confidence: toNumber(row.confidence),
    hitl_required: Boolean(row.hitl_required),
    priority: row.priority as Priority,
    payload: (row.payload as Record<string, unknown> | null) ?? {},
    entity_refs: (row.entity_refs as ResolvedEntity[] | null) ?? [],
    matrix_row_id: (row.matrix_row_id as string | null) ?? null,
    approver_tier:
      row.approver_tier === null || row.approver_tier === undefined
        ? null
        : toNumber(row.approver_tier),
    approver_user_id: (row.approver_user_id as string | null) ?? null,
    decline_reason: (row.decline_reason as string | null) ?? null,
    edited_from_id: (row.edited_from_id as string | null) ?? null,
    failure_reason: (row.failure_reason as string | null) ?? null,
    resolved_at: toIsoOrNull(row.resolved_at),
    expires_at: toIsoOrNull(row.expires_at),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

export function createDrizzleProposalStore(
  db: DrizzleLikeClient,
): ModuleUpdateProposalStore {
  const findById = async (
    tenant_id: string,
    id: string,
  ): Promise<ModuleUpdateProposal | null> => {
    const result = await db.execute(sql`
      SELECT * FROM module_update_proposals
      WHERE tenant_id = ${tenant_id} AND id = ${id}
      LIMIT 1
    `);
    const rows = rowsOf(result);
    return rows.length > 0 ? rowToProposal(rows[0]) : null;
  };

  return {
    async insert(row) {
      await db.execute(sql`
        INSERT INTO module_update_proposals (
          id, tenant_id, capture_id, module_template_id, action, persona_id,
          status, confidence, hitl_required, priority, payload, entity_refs,
          matrix_row_id, approver_tier, approver_user_id, decline_reason,
          edited_from_id, failure_reason, resolved_at, expires_at,
          created_at, updated_at
        ) VALUES (
          ${row.id}, ${row.tenant_id}, ${row.capture_id},
          ${row.module_template_id}, ${row.action}, ${row.persona_id},
          ${row.status}, ${row.confidence}, ${row.hitl_required},
          ${row.priority}, ${JSON.stringify(row.payload ?? {})}::jsonb,
          ${JSON.stringify(row.entity_refs ?? [])}::jsonb,
          ${row.matrix_row_id}, ${row.approver_tier}, ${row.approver_user_id},
          ${row.decline_reason}, ${row.edited_from_id}, ${row.failure_reason},
          ${row.resolved_at}, ${row.expires_at}, ${row.created_at},
          ${row.updated_at}
        )
        ON CONFLICT (id) DO NOTHING
      `);
    },
    findById,
    async update(tenant_id, id, patch) {
      const existing = await findById(tenant_id, id);
      if (!existing) {
        throw new Error(`proposal ${id} not found for tenant ${tenant_id}`);
      }
      // Merge in-app, then persist the full mutable column-set. Keeping the
      // whole row authoritative avoids per-field dynamic SQL while still
      // honouring immutability (new object, no input mutation).
      const merged: ModuleUpdateProposal = {
        ...existing,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      await db.execute(sql`
        UPDATE module_update_proposals
        SET status = ${merged.status},
            confidence = ${merged.confidence},
            hitl_required = ${merged.hitl_required},
            priority = ${merged.priority},
            payload = ${JSON.stringify(merged.payload ?? {})}::jsonb,
            entity_refs = ${JSON.stringify(merged.entity_refs ?? [])}::jsonb,
            matrix_row_id = ${merged.matrix_row_id},
            approver_tier = ${merged.approver_tier},
            approver_user_id = ${merged.approver_user_id},
            decline_reason = ${merged.decline_reason},
            edited_from_id = ${merged.edited_from_id},
            failure_reason = ${merged.failure_reason},
            resolved_at = ${merged.resolved_at},
            expires_at = ${merged.expires_at},
            updated_at = ${merged.updated_at}
        WHERE tenant_id = ${tenant_id} AND id = ${id}
      `);
      return merged;
    },
    async listByTenant(tenant_id, filter) {
      const conds = [sql`tenant_id = ${tenant_id}`];
      if (filter?.status) conds.push(sql`status = ${filter.status}`);
      if (filter?.module_template_id)
        conds.push(sql`module_template_id = ${filter.module_template_id}`);
      if (filter?.persona_id)
        conds.push(sql`persona_id = ${filter.persona_id}`);
      let where = conds[0];
      for (let i = 1; i < conds.length; i++) {
        where = sql`${where} AND ${conds[i]}`;
      }
      const result = await db.execute(sql`
        SELECT * FROM module_update_proposals
        WHERE ${where}
        ORDER BY created_at DESC
      `);
      return rowsOf(result).map(rowToProposal);
    },
  };
}

// ─── TabEventLogStore (tab_event_log) ──────────────────────────────────

function rowToEvent(row: Record<string, unknown>): TabEventLogEntry {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    capture_id: (row.capture_id as string | null) ?? null,
    proposal_id: (row.proposal_id as string | null) ?? null,
    module_template_id: (row.module_template_id as string | null) ?? null,
    persona_id: String(row.persona_id),
    event_kind: row.event_kind as TabEventLogEntry['event_kind'],
    actor: String(row.actor),
    transport: String(row.transport ?? 'api'),
    snapshot: (row.snapshot as Record<string, unknown> | null) ?? {},
    notes: (row.notes as string | null) ?? null,
    sequence: toNumber(row.sequence),
    created_at: toIso(row.created_at),
  };
}

export function createDrizzleEventLogStore(
  db: DrizzleLikeClient,
): TabEventLogStore {
  return {
    async append(row) {
      await db.execute(sql`
        INSERT INTO tab_event_log (
          id, tenant_id, capture_id, proposal_id, module_template_id,
          persona_id, event_kind, actor, transport, snapshot, notes,
          sequence, created_at
        ) VALUES (
          ${row.id}, ${row.tenant_id}, ${row.capture_id}, ${row.proposal_id},
          ${row.module_template_id}, ${row.persona_id}, ${row.event_kind},
          ${row.actor}, ${row.transport},
          ${JSON.stringify(row.snapshot ?? {})}::jsonb, ${row.notes},
          ${row.sequence}, ${row.created_at}
        )
        ON CONFLICT (id) DO NOTHING
      `);
    },
    async listByProposal(tenant_id, proposal_id) {
      const result = await db.execute(sql`
        SELECT * FROM tab_event_log
        WHERE tenant_id = ${tenant_id} AND proposal_id = ${proposal_id}
        ORDER BY sequence ASC
      `);
      return rowsOf(result).map(rowToEvent);
    },
    async listByTenant(tenant_id, limit) {
      const cap = limit ?? 100;
      const result = await db.execute(sql`
        SELECT * FROM tab_event_log
        WHERE tenant_id = ${tenant_id}
        ORDER BY created_at DESC
        LIMIT ${cap}
      `);
      return rowsOf(result).map(rowToEvent);
    },
  };
}

// ─── AuditChainSink (ai_audit_chain) ───────────────────────────────────

/**
 * Drizzle-backed audit-chain sink. Looks up the latest hash + sequence for
 * the tenant, computes the next link via `buildChainLink` (the same hash
 * function the in-memory sink and the verifier use), and appends it. The
 * read+append is not transactional here — the dispatcher's hook is
 * fire-and-forget and a rare race only produces a verifier-detectable
 * duplicate sequence, never a money-path or RLS violation.
 */
export function createDrizzleAuditChainSink(
  db: DrizzleLikeClient,
): AuditChainSink {
  const nextFor = async (
    tenant_id: string,
  ): Promise<{ prev_hash: string; sequence_id: number }> => {
    const result = await db.execute(sql`
      SELECT this_hash, sequence_id FROM ai_audit_chain
      WHERE tenant_id = ${tenant_id}
      ORDER BY sequence_id DESC
      LIMIT 1
    `);
    const rows = rowsOf(result);
    if (rows.length === 0) {
      return { prev_hash: 'GENESIS', sequence_id: 1 };
    }
    const last = rows[0];
    return {
      prev_hash: String(last.this_hash),
      sequence_id: toNumber(last.sequence_id) + 1,
    };
  };

  return {
    async append(args): Promise<AuditChainLink> {
      const { prev_hash, sequence_id } = await nextFor(args.tenant_id);
      const link = buildChainLink({
        id: `audit_${args.tenant_id}_${sequence_id}`,
        tenant_id: args.tenant_id,
        turn_id: args.turn_id,
        session_id: args.session_id ?? null,
        action: args.action,
        prev_hash,
        payload: args.payload,
        sequence_id,
      });
      await db.execute(sql`
        INSERT INTO ai_audit_chain (
          id, tenant_id, sequence_id, turn_id, session_id, action,
          prev_hash, this_hash, payload, created_at
        ) VALUES (
          ${link.id}, ${link.tenant_id}, ${link.sequence_id}, ${link.turn_id},
          ${link.session_id}, ${link.action}, ${link.prev_hash},
          ${link.this_hash}, ${JSON.stringify(link.payload ?? {})}::jsonb,
          NOW()
        )
      `);
      return link;
    },
  };
}

// ─── Bundle factory ────────────────────────────────────────────────────

export interface DrizzleDispatchStores {
  readonly captures: ConversationCaptureStore;
  readonly proposals: ModuleUpdateProposalStore;
  readonly events: TabEventLogStore;
  readonly auditSink: AuditChainSink;
}

/**
 * Build the full set of Drizzle-backed dispatch-router stores from a live
 * DB handle. Returns `null` when `db` is missing so the composition root
 * can fall back to the in-memory defaults transparently — same degraded
 * pattern as `createDrizzleAiAuditChainRepo`.
 */
export function createDrizzleDispatchStores(
  db: unknown,
): DrizzleDispatchStores | null {
  if (!db) return null;
  // The live `DatabaseClient` satisfies `DrizzleLikeClient` structurally
  // via `db.execute(sql\`...\`)`; we duck-cast through `unknown` rather
  // than importing the database package's namespace types here — same
  // convention as `audit-sink-drizzle-adapter.ts`.
  const client = db as DrizzleLikeClient;
  return {
    captures: createDrizzleCaptureStore(client),
    proposals: createDrizzleProposalStore(client),
    events: createDrizzleEventLogStore(client),
    auditSink: createDrizzleAuditChainSink(client),
  };
}
