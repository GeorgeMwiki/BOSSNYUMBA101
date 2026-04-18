/**
 * Postgres-backed migration repository (Drizzle).
 *
 * Phase 2 wiring. The SQL-layer details are stubbed with TODOs but the
 * overall shape (transaction, ON CONFLICT DO NOTHING on natural keys,
 * per-kind skip tracking) is in place so higher layers can be built
 * against a real contract.
 */

import { randomUUID } from 'node:crypto';
import type {
  IMigrationRepository,
  MigrationBundle,
  RunInTransactionResult,
} from './migration-repository.interface.js';
import type {
  MigrationRun,
  MigrationRunStatus,
  MigrationRunCounts,
} from './migration-run.js';

/**
 * Minimal Drizzle-like client surface. Intentionally typed loosely so we
 * don't hard-couple this package to `@bossnyumba/database` during
 * scaffolding — the production wiring replaces `db` with the real Drizzle
 * instance.
 */
export interface DrizzleLike {
  transaction<T>(fn: (tx: DrizzleLike) => Promise<T>): Promise<T>;
  // TODO: tighten these once @bossnyumba/database exports the tables.
  insert(table: unknown): {
    values(values: unknown): {
      onConflictDoNothing(): { returning(): Promise<Array<{ id: string }>> };
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

export interface PostgresMigrationRepositoryDeps {
  readonly db: DrizzleLike;
  readonly now?: () => Date;
}

export class PostgresMigrationRepository implements IMigrationRepository {
  private readonly db: DrizzleLike;
  private readonly now: () => Date;

  /** In-memory projection of runs until the SQL wiring lands. Phase 2
   *  replaces this with SELECT/UPDATE on the migration_runs table. */
  private readonly runCache = new Map<string, MigrationRun>();

  constructor(deps: PostgresMigrationRepositoryDeps) {
    this.db = deps.db;
    this.now = deps.now ?? (() => new Date());
  }

  async createRun(input: {
    tenantId: string;
    createdBy: string;
    uploadFilename: string | null;
    uploadMimeType: string | null;
    uploadSizeBytes: number | null;
  }): Promise<MigrationRun> {
    const nowIso = this.now().toISOString();
    const run: MigrationRun = {
      id: randomUUID(),
      tenantId: input.tenantId,
      createdBy: input.createdBy,
      status: 'uploaded',
      uploadFilename: input.uploadFilename,
      uploadMimeType: input.uploadMimeType,
      uploadSizeBytes: input.uploadSizeBytes,
      extractionSummary: null,
      diffSummary: null,
      committedSummary: null,
      errorMessage: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      approvedAt: null,
      committedAt: null,
      bundle: null,
    };

    // TODO: INSERT INTO migration_runs (...) VALUES (...)
    //   await this.db.insert(migrationRuns).values({ ... });
    this.runCache.set(cacheKey(run.tenantId, run.id), run);
    return run;
  }

  async findRun(runId: string, tenantId: string): Promise<MigrationRun | null> {
    // TODO: SELECT ... FROM migration_runs WHERE id=$1 AND tenant_id=$2
    return this.runCache.get(cacheKey(tenantId, runId)) ?? null;
  }

  async updateStatus(
    runId: string,
    tenantId: string,
    status: MigrationRunStatus,
    patch: Partial<MigrationRun> = {}
  ): Promise<MigrationRun> {
    const existing = await this.findRun(runId, tenantId);
    if (!existing) {
      throw new Error(`MigrationRun not found: ${runId}`);
    }
    const nowIso = this.now().toISOString();
    const merged: MigrationRun = {
      ...existing,
      ...patch,
      status,
      updatedAt: nowIso,
    };
    // TODO: UPDATE migration_runs SET status=$1, ... WHERE id=$2 AND tenant_id=$3
    this.runCache.set(cacheKey(tenantId, runId), merged);
    return merged;
  }

  async runInTransaction(
    tenantId: string,
    _runId: string,
    bundle: MigrationBundle
  ): Promise<RunInTransactionResult> {
    return this.db.transaction(async (_tx) => {
      const counts: MigrationRunCounts = {
        properties: 0,
        units: 0,
        tenants: 0,
        employees: 0,
        departments: 0,
        teams: 0,
      };
      const skipped: Record<string, string[]> = {
        properties: [],
        units: [],
        tenants: [],
        employees: [],
        departments: [],
        teams: [],
      };

      // TODO: for each kind, INSERT ... ON CONFLICT DO NOTHING RETURNING id.
      // Natural-key conflict targets:
      //   properties  → (tenant_id, name)
      //   units       → (tenant_id, property_id, label)
      //   tenants     → (tenant_id, phone)  -- or email when phone missing
      //   employees   → (tenant_id, employee_code)
      //   departments → (tenant_id, code)
      //   teams       → (tenant_id, code)
      // Increment counts[kind] by returning.length. Push skipReason for
      // every row that fell through (conflict, missing FK, validation).

      // Phase 2 placeholder: simulate "all-new" semantics so the service
      // wiring above gets exercised. The real SQL implementation will
      // replace this block; do NOT rely on these counts in production.
      const props = toWriteCount(bundle.properties, tenantId, skipped.properties!, 'property.name');
      const units = toWriteCount(bundle.units, tenantId, skipped.units!, 'unit.(propertyName,label)');
      const tenants = toWriteCount(bundle.tenants, tenantId, skipped.tenants!, 'tenant.phone');
      const emps = toWriteCount(bundle.employees, tenantId, skipped.employees!, 'employee.employeeCode');
      const depts = toWriteCount(bundle.departments, tenantId, skipped.departments!, 'department.code');
      const teams = toWriteCount(bundle.teams, tenantId, skipped.teams!, 'team.code');

      return {
        counts: {
          properties: props,
          units: units,
          tenants: tenants,
          employees: emps,
          departments: depts,
          teams: teams,
        },
        skipped,
      };
    });
  }
}

function cacheKey(tenantId: string, runId: string): string {
  return `${tenantId}::${runId}`;
}

function toWriteCount(
  rows: ReadonlyArray<Record<string, unknown>>,
  _tenantId: string,
  _skipBucket: string[],
  _naturalKey: string
): number {
  // TODO: replace with actual insert + returning length. For now every row
  // is treated as written; real skip tracking happens once the insert
  // runs and ON CONFLICT matches are counted.
  return rows.length;
}
