/**
 * Drizzle-backed audit-log read-back service.
 *
 * Backs `GET /api/v1/admin/audit/log` (admin-audit.hono.ts). Reads the
 * canonical, append-only `audit_events` table — filtered by tenant / actor /
 * action / time-range — with keyset (cursor) pagination over a stable,
 * monotonic ordering.
 *
 * Column source of truth
 * ──────────────────────
 * Columns match the LIVE `audit_events` DDL created by migration
 * 0313_schema_drift_catchup.sql (the barrel-winning canonical table):
 *   id, tenant_id, event_type (enum), action, description, actor_id,
 *   actor_email, actor_name, actor_type, target_type, target_id, metadata,
 *   occurred_at.
 * NOTE: the Drizzle mirror `audit-events.schema.ts` is aspirational drift
 * (timestamp_ms / category / outcome / severity) that the live table does NOT
 * have — this service deliberately targets the migration DDL, not the mirror.
 *
 * Zero invented data: every row returned is a real persisted audit event. When
 * a filter matches nothing the result is an empty list with a `null` cursor —
 * but the *route* only reaches this service when it is actually wired; an
 * unwired deployment returns 503 AUDIT_LOG_UNAVAILABLE, never empty-success.
 *
 * Pagination contract
 * ───────────────────
 *  - Ordering: `(occurred_at DESC, id DESC)` — newest first, `id` as the
 *    deterministic tie-breaker so two events at the same instant never straddle
 *    a page boundary inconsistently.
 *  - The opaque cursor encodes the last row's `(occurred_at, id)`. The next
 *    page is `WHERE (occurred_at, id) < (cursorTs, cursorId)` — a true keyset
 *    seek (no OFFSET drift, RLS-safe).
 *  - `limit` rows are requested + 1 probe row; if the probe exists a
 *    `nextCursor` is emitted, otherwise `nextCursor` is null (last page).
 *
 * The drizzle client is treated structurally (raw parameterised `sql` via
 * `.execute`) so this file stays decoupled from the widened `DatabaseClient`
 * namespace alias — the same approach `credit-rating-repository.ts` uses.
 */

import { sql } from 'drizzle-orm';

type DbClient = unknown;
type SqlTag = ReturnType<typeof sql>;

export interface AuditLogQueryArgs {
  readonly tenantId?: string;
  readonly actor?: string;
  readonly action?: string;
  readonly since?: string;
  readonly until?: string;
  readonly limit: number;
  readonly cursor?: string;
}

export interface AuditLogItem {
  readonly id: string;
  readonly event: string;
  readonly action?: string;
  readonly actor: string;
  readonly tenantId?: string;
  readonly timestamp: string;
  readonly payload?: Record<string, unknown>;
}

export interface AuditLogQueryResult {
  readonly items: ReadonlyArray<AuditLogItem>;
  readonly nextCursor?: string | null;
}

export interface AuditLogQueryService {
  query(args: AuditLogQueryArgs): Promise<AuditLogQueryResult>;
}

interface AuditEventRow {
  readonly id: string;
  readonly tenant_id: string | null;
  readonly event_type: string | null;
  readonly action: string | null;
  readonly description: string | null;
  readonly actor_id: string | null;
  readonly actor_name: string | null;
  readonly actor_type: string | null;
  readonly target_type: string | null;
  readonly target_id: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly occurred_at: Date | string | null;
}

/** Hard ceiling so a caller can never request an unbounded page. */
const MAX_LIMIT = 500;

function execute<T = Record<string, unknown>>(
  db: DbClient,
  stmt: SqlTag,
): Promise<T[]> {
  // drizzle `.execute` returns either an array (postgres.js) or
  // `{ rows: [...] }` (node-postgres). Normalise to an array.
  const runner = db as { execute(q: SqlTag): Promise<unknown> };
  return runner.execute(stmt).then((res: unknown) => {
    if (Array.isArray(res)) return res as T[];
    return ((res as { rows?: T[] })?.rows ?? []) as T[];
  });
}

/** Encode `(occurredAtIso, id)` as an opaque base64url cursor. */
function encodeCursor(occurredAtIso: string, id: string): string {
  return Buffer.from(`${occurredAtIso}|${id}`, 'utf8').toString('base64url');
}

/**
 * Decode a cursor back to `(occurredAtIso, id)`. Returns null on any malformed
 * input so a tampered cursor degrades to "first page" rather than throwing —
 * the read is always tenant/role-scoped above, so this can never leak across
 * tenants.
 */
function decodeCursor(
  cursor: string,
): { readonly occurredAtIso: string; readonly id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = raw.indexOf('|');
    if (sep <= 0) return null;
    const occurredAtIso = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    if (id.length === 0 || Number.isNaN(Date.parse(occurredAtIso))) return null;
    return { occurredAtIso, id };
  } catch {
    return null;
  }
}

function toIso(value: Date | string | null): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function rowToItem(row: AuditEventRow): AuditLogItem {
  const item: {
    id: string;
    event: string;
    action?: string;
    actor: string;
    tenantId?: string;
    timestamp: string;
    payload?: Record<string, unknown>;
  } = {
    id: row.id,
    // `event` is the human-facing label the console renders; `action` is the
    // machine code. Prefer the canonical event_type, fall back to action.
    event: row.event_type ?? row.action ?? 'audit.event',
    actor: row.actor_name ?? row.actor_id ?? 'unknown',
    timestamp: toIso(row.occurred_at),
  };
  if (row.action) item.action = row.action;
  if (row.tenant_id) item.tenantId = row.tenant_id;
  // A compact payload the read-back surface can show without re-deriving the
  // full event. Redaction of nested PII already happened at write time; we
  // only forward structured descriptors + metadata.
  const payload: Record<string, unknown> = {};
  if (row.description) payload.description = row.description;
  if (row.actor_type) payload.actorType = row.actor_type;
  if (row.target_type) payload.targetType = row.target_type;
  if (row.target_id) payload.targetId = row.target_id;
  if (row.metadata && typeof row.metadata === 'object') {
    payload.metadata = row.metadata;
  }
  if (Object.keys(payload).length > 0) item.payload = payload;
  return item;
}

/**
 * Create the Drizzle-backed audit-log read-back service. Returns null when no
 * db client is available (degraded mode) — the registry then leaves the slot
 * unwired and the route fails loud with 503, never empty-success.
 */
export function createAuditLogQueryService(
  db: DbClient | null,
): AuditLogQueryService | null {
  if (!db) return null;

  return {
    async query(args: AuditLogQueryArgs): Promise<AuditLogQueryResult> {
      const limit = Math.max(1, Math.min(args.limit ?? 50, MAX_LIMIT));

      // Build an AND-composed predicate list. Every value is bound — never
      // interpolated — so the read is injection-safe.
      const predicates: SqlTag[] = [];

      if (args.tenantId !== undefined) {
        predicates.push(sql`tenant_id = ${args.tenantId}`);
      }
      if (args.actor !== undefined) {
        // Match either the stable actor id or the display name.
        predicates.push(
          sql`(actor_id = ${args.actor} OR actor_name = ${args.actor})`,
        );
      }
      if (args.action !== undefined) {
        predicates.push(sql`action = ${args.action}`);
      }
      if (args.since !== undefined) {
        const since = new Date(args.since);
        if (!Number.isNaN(since.getTime())) {
          predicates.push(sql`occurred_at >= ${since.toISOString()}`);
        }
      }
      if (args.until !== undefined) {
        const until = new Date(args.until);
        if (!Number.isNaN(until.getTime())) {
          predicates.push(sql`occurred_at <= ${until.toISOString()}`);
        }
      }

      // Keyset seek for the requested page.
      if (args.cursor !== undefined) {
        const decoded = decodeCursor(args.cursor);
        if (decoded) {
          predicates.push(
            sql`(occurred_at, id) < (${decoded.occurredAtIso}, ${decoded.id})`,
          );
        }
      }

      const whereClause =
        predicates.length > 0
          ? sql`WHERE ${sql.join(predicates, sql` AND `)}`
          : sql``;

      // Fetch limit + 1 to detect whether a further page exists.
      const probeLimit = limit + 1;
      const rows = await execute<AuditEventRow>(
        db,
        sql`
          SELECT id, tenant_id, event_type, action, description, actor_id,
                 actor_name, actor_type, target_type, target_id, metadata,
                 occurred_at
          FROM audit_events
          ${whereClause}
          ORDER BY occurred_at DESC, id DESC
          LIMIT ${probeLimit}
        `,
      );

      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const items = pageRows.map(rowToItem);

      let nextCursor: string | null = null;
      if (hasMore && pageRows.length > 0) {
        const last = pageRows[pageRows.length - 1]!;
        nextCursor = encodeCursor(toIso(last.occurred_at), last.id);
      }

      return { items, nextCursor };
    },
  };
}
