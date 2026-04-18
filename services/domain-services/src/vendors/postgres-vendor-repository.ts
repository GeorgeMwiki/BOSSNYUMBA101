/**
 * Postgres Vendor Repository — SCAFFOLDED 9
 *
 * Concrete implementation of `VendorRepositoryPort` backed by Drizzle +
 * Postgres. Kept free of business logic — scoring and rating recompute
 * live in `vendor-score-calculator.ts` and `vendor-rating-worker.ts`
 * respectively.
 *
 * The repo works through a pluggable `DrizzleLike` surface so tests can
 * inject an in-memory stub without a live database. Callers wire in the
 * real Drizzle client from `@bossnyumba/database`.
 */

import type {
  FindCandidatesParams,
  VendorMatchCategory,
  VendorProfileDto,
  VendorRatingUpdate,
  VendorRepositoryPort,
  VendorWorkOrderOutcomeDto,
} from './vendor-repository.interface.js';

// ---------------------------------------------------------------------------
// Minimal abstraction over the Drizzle client — tests mock this directly.
// We intentionally avoid importing the real Drizzle module to keep this
// file buildable without DB credentials present.
// ---------------------------------------------------------------------------

export interface DrizzleLike {
  query: {
    vendors: {
      findMany(args: unknown): Promise<VendorRowLike[]>;
      findFirst(args: unknown): Promise<VendorRowLike | null>;
    };
    workOrders?: {
      findMany(args: unknown): Promise<WorkOrderOutcomeRowLike[]>;
    };
  };
  execute?: (query: unknown) => Promise<unknown>;
  update?: (table: unknown) => {
    set(values: Record<string, unknown>): {
      where(condition: unknown): Promise<unknown>;
    };
  };
}

export interface VendorRowLike {
  id: string;
  tenantId: string;
  vendorCode: string;
  companyName: string;
  status: string;
  specializations?: unknown;
  serviceAreas?: unknown;
  rateCards?: unknown;
  performanceMetrics?: unknown;
  isPreferred: boolean;
  emergencyAvailable: boolean;
  ratingLastComputedAt?: Date | null;
  ratingSampleSize?: number | null;
}

export interface WorkOrderOutcomeRowLike {
  id: string;
  vendorId: string | null;
  tenantId: string;
  completedAt: Date | null;
  ratingOverall?: number | null;
  ratingQuality?: number | null;
  ratingCommunication?: number | null;
  firstResponseMinutes?: number | null;
  scheduledAt?: Date | null;
  actualStartAt?: Date | null;
  actualCompletionAt?: Date | null;
  costActual?: number | null;
  costEstimated?: number | null;
  wasReopened?: boolean | null;
}

// ---------------------------------------------------------------------------
// Row → DTO mapping
// ---------------------------------------------------------------------------

function coerceArray<T>(raw: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(raw)) return raw as T[];
  return fallback;
}

function coerceObject<T extends Record<string, unknown>>(raw: unknown, fallback: T): T {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as T;
  return fallback;
}

function mapVendorRow(row: VendorRowLike): VendorProfileDto {
  const metrics = coerceObject(row.performanceMetrics, {}) as Record<string, unknown>;
  const ratings = coerceObject((metrics as { ratings?: unknown }).ratings, {}) as Record<
    string,
    unknown
  >;
  const rateCard = coerceArray<{ hourlyRate?: number; currency?: string }>(row.rateCards, []);
  const firstRate = rateCard[0];

  return {
    id: row.id,
    tenantId: row.tenantId,
    vendorCode: row.vendorCode,
    name: row.companyName,
    status: row.status as VendorProfileDto['status'],
    categories: coerceArray<VendorMatchCategory>(row.specializations, []),
    serviceAreas: coerceArray<string>(row.serviceAreas, []),
    ratings: {
      overall: Number(ratings.overall ?? 0),
      quality: Number(ratings.quality ?? 0),
      reliability: Number(ratings.reliability ?? 0),
      communication: Number(ratings.communication ?? 0),
      value: Number(ratings.value ?? 0),
    },
    metrics: {
      completedJobs: Number((metrics as { completedJobs?: number }).completedJobs ?? 0),
      averageResponseTimeHours: Number(
        (metrics as { averageResponseTimeHours?: number }).averageResponseTimeHours ?? 0
      ),
      onTimeCompletionPct: Number(
        (metrics as { onTimeCompletionPct?: number }).onTimeCompletionPct ?? 0
      ),
      repeatCallRatePct: Number(
        (metrics as { repeatCallRatePct?: number }).repeatCallRatePct ?? 0
      ),
    },
    isPreferred: Boolean(row.isPreferred),
    emergencyAvailable: Boolean(row.emergencyAvailable),
    afterHoursAvailable: Boolean((metrics as { afterHoursAvailable?: boolean }).afterHoursAvailable),
    ratingLastComputedAt: row.ratingLastComputedAt ?? null,
    ratingSampleSize: row.ratingSampleSize ?? 0,
    hourlyRate: firstRate?.hourlyRate ?? null,
    currency: firstRate?.currency ?? 'KES',
  };
}

function mapWorkOrderOutcome(row: WorkOrderOutcomeRowLike): VendorWorkOrderOutcomeDto | null {
  if (!row.vendorId || !row.completedAt) return null;
  return {
    workOrderId: row.id,
    vendorId: row.vendorId,
    tenantId: row.tenantId,
    completedAt: row.completedAt,
    ratingOverall: row.ratingOverall ?? null,
    ratingQuality: row.ratingQuality ?? null,
    ratingCommunication: row.ratingCommunication ?? null,
    firstResponseMinutes: row.firstResponseMinutes ?? null,
    scheduledAt: row.scheduledAt ?? null,
    actualStartAt: row.actualStartAt ?? null,
    actualCompletionAt: row.actualCompletionAt ?? null,
    costActual: row.costActual ?? null,
    costEstimated: row.costEstimated ?? null,
    wasReopened: Boolean(row.wasReopened),
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class PostgresVendorRepository implements VendorRepositoryPort {
  constructor(private readonly db: DrizzleLike) {}

  async findCandidates(params: FindCandidatesParams): Promise<VendorProfileDto[]> {
    const excluded = new Set(params.excludeStatuses ?? ['suspended', 'blacklisted']);
    const limit = params.limit ?? 50;

    // The query shape uses `findMany` with a filter hint — the actual
    // Drizzle implementation can refine with SQL filters; at the
    // interface level we let this be permissive so the repo can
    // be wired to different query helpers.
    const rows = await this.db.query.vendors.findMany({
      where: {
        tenantId: params.tenantId,
      },
      limit,
    });

    return rows
      .map(mapVendorRow)
      .filter((v) => !excluded.has(v.status))
      .filter((v) => v.categories.includes(params.category))
      .filter((v) =>
        params.serviceArea ? v.serviceAreas.includes(params.serviceArea) : true
      )
      .filter((v) => (params.emergency ? v.emergencyAvailable : true));
  }

  async findById(tenantId: string, vendorId: string): Promise<VendorProfileDto | null> {
    const row = await this.db.query.vendors.findFirst({
      where: { id: vendorId, tenantId },
    });
    return row ? mapVendorRow(row) : null;
  }

  async findAllActive(tenantId: string): Promise<VendorProfileDto[]> {
    const rows = await this.db.query.vendors.findMany({
      where: { tenantId, status: 'active' },
    });
    return rows.map(mapVendorRow).filter((v) => v.status === 'active');
  }

  async listRecentOutcomes(params: {
    tenantId: string;
    vendorId: string;
    windowStart: Date;
    windowEnd: Date;
  }): Promise<VendorWorkOrderOutcomeDto[]> {
    if (!this.db.query.workOrders) return [];
    const rows = await this.db.query.workOrders.findMany({
      where: {
        tenantId: params.tenantId,
        vendorId: params.vendorId,
      },
    });
    return rows
      .map(mapWorkOrderOutcome)
      .filter((o): o is VendorWorkOrderOutcomeDto => o !== null)
      .filter(
        (o) =>
          o.completedAt >= params.windowStart && o.completedAt <= params.windowEnd
      );
  }

  async updateRatingAggregate(update: VendorRatingUpdate): Promise<void> {
    // We write back through an update path. If the injected client
    // doesn't expose `.update`, we no-op — tests typically stub this.
    if (!this.db.update) return;
    await this.db
      .update({ name: 'vendors' })
      .set({
        performanceMetrics: {
          ratings: update.ratings,
          completedJobs: update.metrics.completedJobs,
          averageResponseTimeHours: update.metrics.averageResponseTimeHours,
          onTimeCompletionPct: update.metrics.onTimeCompletionPct,
          repeatCallRatePct: update.metrics.repeatCallRatePct,
        },
        ratingLastComputedAt: update.computedAt,
        ratingSampleSize: update.sampleSize,
        updatedAt: new Date(),
      })
      .where({ id: update.vendorId, tenantId: update.tenantId });
  }
}

/**
 * Convenience factory — accepts a Drizzle client and returns the repo.
 * Keeps the construction noise out of each call site.
 */
export function createPostgresVendorRepository(db: DrizzleLike): VendorRepositoryPort {
  return new PostgresVendorRepository(db);
}
