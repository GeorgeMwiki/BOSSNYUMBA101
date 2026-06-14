/**
 * Composition-root shared primitives.
 *
 * The adapters in this directory wire the abstract nightly-sweep ports
 * (`schedule/cron-handler.ts`) to the real Drizzle-backed services in
 * `@bossnyumba/database` and the constitution verifier in
 * `@bossnyumba/autonomy-governance`.
 *
 * `DrizzleLikeClient` is the same minimal duck-type the sibling
 * `consolidation-worker` composition root uses: a structural type that
 * accepts the api-gateway Drizzle client without importing its concrete
 * (namespace-colliding) `DatabaseClient` type. The database service
 * factories accept `db as never`, mirroring the sibling worker.
 */

/** Minimal structural client — `db.execute(sql\`…\`)` is all the raw adapters need. */
export interface DrizzleLikeClient {
  execute(q: unknown): Promise<unknown>;
}

/** Normalise a Drizzle `execute` result into a plain row array. */
export function toRows(
  result: unknown,
): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(result)) {
    return result as ReadonlyArray<Record<string, unknown>>;
  }
  const wrapped = (result as { rows?: ReadonlyArray<Record<string, unknown>> })
    ?.rows;
  return Array.isArray(wrapped) ? wrapped : [];
}

export function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

export function asNullableString(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

export function asDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' && v.length > 0) return v;
  return new Date().toISOString();
}

export function asRecord(v: unknown): Readonly<Record<string, unknown>> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

export function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function clampLimit(input: number | undefined, fallback: number): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(input), 50_000);
}
