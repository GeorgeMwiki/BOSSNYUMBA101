/**
 * Seed-tool adapters — bind the kernel's 5 PM seed BrainTools to REAL
 * domain backing instead of the `buildPlaceholderSeedToolDeps` stub that
 * throws "not yet wired".
 *
 * PART B wires three of the seed tools to existing infrastructure:
 *
 *   - `lookupTenantArrears`        → replays the immutable arrears ledger
 *                                    (`createPostgresArrearsEntryLoader`)
 *                                    and projects the outstanding balance
 *                                    + aging (`createArrearsProjectionService`).
 *   - `getMarketRateBand`          → reads the latest `market_rate_snapshots`
 *                                    comp band (`createMarketRateSnapshotsService`).
 *   - `checkComplianceCertificate` → NO backing exists (the RERA / NIDA
 *                                    certificate registry is not wired).
 *                                    Honestly DEGRADES: returns a
 *                                    `status: 'not-found'` shaped result so
 *                                    the registry's zod output gate passes
 *                                    and the kernel surfaces a clean "no
 *                                    record" rather than crashing. Flip to
 *                                    a real adapter when the registry lands.
 *
 * H3 — per-turn tenant scoping. The kernel's `BrainToolSpec.executor` now
 * receives an optional `BrainToolInvocationContext` carrying the CALLING
 * scope (the dispatcher threads `HookContext.scope` through
 * `registry.runTool(name, input, { scope })`). These adapters read the
 * tenant from that per-turn scope and fall back to the boot-time
 * `deps.tenantId` (`_platform` on the primary path) ONLY when no
 * tenant-scoped context is supplied. A tenant-scoped turn therefore yields
 * THAT tenant's arrears / market-rate rather than the platform zero-state.
 *
 * Every adapter degrades gracefully: a missing case / missing snapshot
 * resolves to a valid zero-state output (never a throw), and a hard DB
 * fault is logged + rethrown as the registry's `executor-failed` (the
 * disciplined failure the audit trail records).
 */

import { createArrearsProjectionService } from '@bossnyumba/payments-ledger-service/arrears';
import { createMarketRateSnapshotsService } from '@bossnyumba/database';
import type { ArrearsEntryLoader } from './arrears-infrastructure.js';

/**
 * Concrete service + row shapes derived from the factory return type.
 * Importing the named `type MarketRateSnapshotsService` /
 * `MarketRateSnapshotShape` trips TS2709 (namespace-vs-type barrel drift
 * the rest of this composition layer also routes around — see
 * `brain-kernel-wiring.ts`), so we derive them locally instead.
 */
type MarketRateSnapshotsService = ReturnType<
  typeof createMarketRateSnapshotsService
>;
type MarketRateSnapshotShape = Awaited<
  ReturnType<MarketRateSnapshotsService['listRecent']>
>[number];
import type {
  SeedBrainToolDeps,
  BrainToolInvocationContext,
  LookupTenantArrearsInput,
  LookupTenantArrearsOutput,
  GetMarketRateBandInput,
  GetMarketRateBandOutput,
  CheckComplianceCertificateInput,
  CheckComplianceCertificateOutput,
} from '@bossnyumba/central-intelligence';

/** Structural Drizzle shape — the market-rate service accepts the same. */
type DatabaseLike = Parameters<typeof createMarketRateSnapshotsService>[0];

export interface SeedToolAdapterLogger {
  readonly warn?: (meta: object, msg: string) => void;
}

export interface SeedToolAdapterDeps {
  /** Drizzle client (the deployment DB). */
  readonly db: DatabaseLike;
  /** Arrears ledger loader (already constructed at the composition root). */
  readonly arrearsEntryLoader: ArrearsEntryLoader;
  /**
   * The tenant the brain-kernel wiring is constructed under. The arrears
   * loader is tenant-scoped; the platform path passes `_platform` and the
   * kernel tool pipeline re-binds the per-request tenant at dispatch.
   */
  readonly tenantId: string;
  readonly logger?: SeedToolAdapterLogger;
}

/** Default currency when a zero-state result carries no currency signal. */
const DEFAULT_CURRENCY = 'TZS';

/**
 * H3 — resolve the tenant the executor should bind to for THIS call. Prefer
 * the per-turn calling scope (a tenant-scoped turn carries
 * `scope.kind === 'tenant'` + `tenantId`); fall back to the boot-time
 * deployment tenant (`_platform` on the primary path) ONLY when no
 * tenant-scoped context is supplied (e.g. a platform-HQ turn or a legacy
 * caller that did not thread scope). This is what makes a tenant-scoped turn
 * yield that tenant's data instead of the platform zero-state.
 */
function resolveTenantId(
  deps: SeedToolAdapterDeps,
  ctx?: BrainToolInvocationContext,
): string {
  const scope = ctx?.scope;
  if (scope && scope.kind === 'tenant' && scope.tenantId) {
    return scope.tenantId;
  }
  return deps.tenantId;
}

/**
 * Build the real-backed seed-tool deps. The two backed tools delegate to
 * existing infrastructure; `checkComplianceCertificate` degrades honestly
 * (no registry adapter exists).
 */
export function buildSeedToolDeps(deps: SeedToolAdapterDeps): SeedBrainToolDeps {
  const marketRate = createMarketRateSnapshotsService(deps.db);
  return {
    lookupTenantArrears: makeLookupTenantArrears(deps),
    getMarketRateBand: makeGetMarketRateBand(deps, marketRate),
    checkComplianceCertificate: makeCheckComplianceCertificate(deps),
  };
}

// ─────────────────────────────────────────────────────────────────────
// lookupTenantArrears — replay the immutable ledger + project the balance.
// ─────────────────────────────────────────────────────────────────────

function makeLookupTenantArrears(
  deps: SeedToolAdapterDeps,
): SeedBrainToolDeps['lookupTenantArrears'] {
  const projection = createArrearsProjectionService();
  return async (
    input: LookupTenantArrearsInput,
    ctx?: BrainToolInvocationContext,
  ): Promise<LookupTenantArrearsOutput> => {
    // H3 — bind to the IN-FLIGHT tenant, not the boot-time `_platform`.
    const tenantId = resolveTenantId(deps, ctx);
    const asOf = input.asOfDate ? new Date(input.asOfDate) : new Date();
    const asOfDate = isValidDate(asOf)
      ? asOf.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // The seed tool keys arrears by `tenantProfileId`; the ledger loader
    // keys by `arrearsCaseId`. We treat the profile id as the case key —
    // the loader resolves the customer + currency + immutable entries.
    let loaded: Awaited<ReturnType<ArrearsEntryLoader>>;
    try {
      loaded = await deps.arrearsEntryLoader({
        tenantId,
        arrearsCaseId: input.tenantProfileId,
      });
    } catch (err) {
      // Hard DB fault — log + rethrow so the registry records
      // `executor-failed` (the disciplined failure path).
      deps.logger?.warn?.(
        { err: errMessage(err), tenantProfileId: input.tenantProfileId },
        'seed-tool lookupTenantArrears: ledger load failed',
      );
      throw err instanceof Error ? err : new Error('arrears ledger load failed');
    }

    if (!loaded) {
      // Unknown case — graceful zero-state (valid schema, not a throw).
      return {
        tenantProfileId: input.tenantProfileId,
        arrearsAmount: 0,
        currency: DEFAULT_CURRENCY,
        monthsOverdue: 0,
        asOfDate,
      };
    }

    const result = projection.project({
      tenantId,
      arrearsCaseId: input.tenantProfileId,
      customerId: loaded.customerId,
      currency: loaded.currency,
      entries: loaded.entries,
      asOf: isValidDate(asOf) ? asOf : new Date(),
    });

    return {
      tenantProfileId: input.tenantProfileId,
      // Balance is signed minor-units; a credit (negative) means no
      // arrears. The schema requires non-negative, so clamp at zero.
      arrearsAmount: Math.max(0, result.balanceMinorUnits),
      currency: loaded.currency || DEFAULT_CURRENCY,
      monthsOverdue: Math.max(0, Math.floor(result.daysPastDue / 30)),
      asOfDate,
    };
  };
}

// ─────────────────────────────────────────────────────────────────────
// getMarketRateBand — read the latest comp snapshot band.
// ─────────────────────────────────────────────────────────────────────

function makeGetMarketRateBand(
  deps: SeedToolAdapterDeps,
  service: MarketRateSnapshotsService,
): SeedBrainToolDeps['getMarketRateBand'] {
  return async (
    input: GetMarketRateBandInput,
    ctx?: BrainToolInvocationContext,
  ): Promise<GetMarketRateBandOutput> => {
    // H3 — bind to the IN-FLIGHT tenant, not the boot-time `_platform`.
    const tenantId = resolveTenantId(deps, ctx);
    let snapshots: ReadonlyArray<MarketRateSnapshotShape>;
    try {
      snapshots = await service.listRecent(tenantId, { limit: 50 });
    } catch (err) {
      deps.logger?.warn?.(
        { err: errMessage(err), tenantId },
        'seed-tool getMarketRateBand: snapshot read failed',
      );
      throw err instanceof Error ? err : new Error('market-rate read failed');
    }

    // Prefer a snapshot for the requested property; else the most recent
    // overall (listRecent is already ordered newest-first).
    const match =
      (input.propertyId
        ? snapshots.find((s) => s.propertyId === input.propertyId)
        : undefined) ?? snapshots[0];

    if (!match) {
      // No comps yet — graceful zero-band (valid schema, sampleSize 0).
      return {
        bedrooms: input.bedrooms,
        unitType: input.unitType,
        currency: DEFAULT_CURRENCY,
        p25: 0,
        median: 0,
        p75: 0,
        sampleSize: 0,
      };
    }

    return {
      bedrooms: input.bedrooms,
      unitType: input.unitType,
      currency: match.currencyCode || DEFAULT_CURRENCY,
      p25: nonNeg(match.marketP25Minor),
      median: nonNeg(match.marketMedianMinor),
      p75: nonNeg(match.marketP75Minor),
      sampleSize: Math.max(0, match.marketSampleSize),
    };
  };
}

// ─────────────────────────────────────────────────────────────────────
// checkComplianceCertificate — honestly deploy/feature-gated (no backing).
// ─────────────────────────────────────────────────────────────────────

function makeCheckComplianceCertificate(
  deps: SeedToolAdapterDeps,
): SeedBrainToolDeps['checkComplianceCertificate'] {
  return async (
    input: CheckComplianceCertificateInput,
  ): Promise<CheckComplianceCertificateOutput> => {
    // No RERA / NIDA certificate registry adapter is wired. Rather than
    // throw (which would crash the tool), return a clean `not-found`
    // shaped result so the zod output gate passes and the kernel surfaces
    // "no certificate record" — an honest degrade, not a fabricated
    // "valid". Flip to a real adapter when the registry lands.
    deps.logger?.warn?.(
      {
        certificateId: input.certificateId,
        jurisdiction: input.jurisdiction,
      },
      'seed-tool checkComplianceCertificate: no registry backing; degrading to not-found',
    );
    return {
      certificateId: input.certificateId,
      jurisdiction: input.jurisdiction,
      status: 'not-found',
      issuedAt: null,
      expiresAt: null,
      daysUntilExpiry: null,
    };
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function nonNeg(value: number | null): number {
  return value === null || value < 0 ? 0 : value;
}

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
