/**
 * Persona-aware entity-index query layer (real-estate).
 *
 * Port from Borjie services/api-gateway/src/services/entity-index/query.ts
 *
 * Single entry-point used by the brain tools + the route handlers.
 * Wraps the SQL search/resolve/full-picture/recent calls in the
 * two-pass persona filter.
 *
 * Tenant isolation: the RLS GUC is the authoritative tenant cap; this
 * layer adds the persona ceiling on top.
 */

import { sql } from 'drizzle-orm';
import {
  applyPersonaFilter,
  computePersonaProjection,
  type EntityIndexPersona,
  type EntityIndexRow,
  type PersonaProjection,
} from './persona-filter.js';

export interface EntityIndexQueryDb {
  execute(query: unknown): Promise<unknown>;
}

interface ExecRow extends Record<string, unknown> {}

function rowsOf(result: unknown): ReadonlyArray<ExecRow> {
  if (Array.isArray(result)) return result as ReadonlyArray<ExecRow>;
  const wrapped = result as { rows?: ReadonlyArray<ExecRow> };
  return wrapped?.rows ?? [];
}

function toEntityIndexRow(row: ExecRow): EntityIndexRow {
  const base: Record<string, unknown> = {
    kind: String(row['kind'] ?? row['entity_kind']),
    id: String(row['id'] ?? row['entity_id']),
    displayName: String(row['display_name'] ?? row['displayName'] ?? ''),
    summary: String(row['summary'] ?? ''),
  };
  if (row['tags'] !== undefined && Array.isArray(row['tags'])) {
    base['tags'] = Object.freeze(
      (row['tags'] as ReadonlyArray<unknown>).map(String),
    );
  }
  if (row['lifecycle_stage'] !== undefined || row['lifecycleStage'] !== undefined) {
    base['lifecycleStage'] = String(
      row['lifecycle_stage'] ?? row['lifecycleStage'] ?? 'active',
    );
  }
  if (row['refreshed_at'] !== undefined || row['refreshedAt'] !== undefined) {
    base['refreshedAt'] = String(row['refreshed_at'] ?? row['refreshedAt']);
  }
  if (row['metadata'] !== undefined && row['metadata'] !== null) {
    base['metadata'] = Object.freeze(
      row['metadata'] as Readonly<Record<string, unknown>>,
    );
  }
  return Object.freeze(base) as unknown as EntityIndexRow;
}

export interface QueryEntityIndexInput {
  readonly tenantId: string;
  readonly persona: EntityIndexPersona;
  readonly actorScopeIds: ReadonlyArray<string>;
  readonly query?: string;
  readonly kindFilter?: ReadonlyArray<string>;
  readonly limit?: number;
  readonly language?: 'en' | 'sw';
  readonly counterpartyId?: string | null;
}

export interface QueryEntityIndexResult {
  readonly hits: ReadonlyArray<EntityIndexRow>;
  readonly projection: PersonaProjection;
  readonly queriedAt: string;
}

export async function queryEntityIndex(
  db: EntityIndexQueryDb,
  input: QueryEntityIndexInput,
): Promise<QueryEntityIndexResult> {
  const projection = computePersonaProjection({
    persona: input.persona,
    actorScopeIds: input.actorScopeIds,
    ...(input.counterpartyId !== undefined && {
      counterpartyId: input.counterpartyId,
    }),
  });

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const kindClause =
    input.kindFilter && input.kindFilter.length > 0
      ? sql`AND entity_kind = ANY(${input.kindFilter as string[]}::text[])`
      : sql``;
  const queryClause = input.query
    ? sql`AND (display_name ILIKE ${'%' + input.query + '%'} OR summary ILIKE ${'%' + input.query + '%'})`
    : sql``;

  const rawRows = rowsOf(
    await db.execute(sql`
      SELECT entity_kind, entity_id, display_name, summary, tags,
             lifecycle_stage, refreshed_at
        FROM entity_index
       WHERE tenant_id = ${input.tenantId}
         AND lifecycle_stage = 'active'
         ${queryClause}
         ${kindClause}
       ORDER BY refreshed_at DESC
       LIMIT ${limit}
    `),
  );

  const rows = rawRows.map(toEntityIndexRow);
  const hits = applyPersonaFilter(rows, projection, input.language ?? 'en');

  return Object.freeze({
    hits,
    projection,
    queriedAt: new Date().toISOString(),
  });
}

/** entity.resolve — find by exact id or display name. */
export async function resolveEntity(
  db: EntityIndexQueryDb,
  input: {
    readonly tenantId: string;
    readonly persona: EntityIndexPersona;
    readonly actorScopeIds: ReadonlyArray<string>;
    readonly entityKind: string;
    readonly entityId?: string;
    readonly displayName?: string;
    readonly language?: 'en' | 'sw';
  },
): Promise<EntityIndexRow | null> {
  const projection = computePersonaProjection({
    persona: input.persona,
    actorScopeIds: input.actorScopeIds,
  });
  const ident = input.entityId
    ? sql`AND entity_id = ${input.entityId}`
    : sql`AND display_name ILIKE ${input.displayName ?? ''}`;
  const rawRows = rowsOf(
    await db.execute(sql`
      SELECT entity_kind, entity_id, display_name, summary, tags,
             lifecycle_stage, refreshed_at
        FROM entity_index
       WHERE tenant_id = ${input.tenantId}
         AND entity_kind = ${input.entityKind}
         ${ident}
       LIMIT 1
    `),
  );
  if (rawRows.length === 0) return null;
  const row = toEntityIndexRow(rawRows[0]!);
  const [filtered] = applyPersonaFilter([row], projection, input.language ?? 'en');
  return filtered ?? null;
}

/** entity.recent — most recently refreshed of a kind. */
export async function recentEntities(
  db: EntityIndexQueryDb,
  input: {
    readonly tenantId: string;
    readonly persona: EntityIndexPersona;
    readonly actorScopeIds: ReadonlyArray<string>;
    readonly entityKind: string;
    readonly limit?: number;
    readonly language?: 'en' | 'sw';
  },
): Promise<ReadonlyArray<EntityIndexRow>> {
  const result = await queryEntityIndex(db, {
    tenantId: input.tenantId,
    persona: input.persona,
    actorScopeIds: input.actorScopeIds,
    kindFilter: [input.entityKind],
    ...(input.limit !== undefined && { limit: input.limit }),
    ...(input.language !== undefined && { language: input.language }),
  });
  return result.hits;
}
