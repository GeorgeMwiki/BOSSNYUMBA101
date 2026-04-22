/**
 * DP cross-tenant aggregator.
 *
 * Wires a `TenantAggregateSource` that produces per-tenant
 * contributions, a `PlatformBudgetLedger` that meters privacy spend,
 * and a `NoiseSource` that adds calibrated Laplace/Gaussian noise
 * into a single `aggregate(query)` function.
 *
 * Invariants (enforced programmatically):
 *   1. Refuses slices below k-anonymity threshold (k_min).
 *   2. Never publishes a per-tenant value — only the combined
 *      statistic.
 *   3. Consumes the platform privacy budget BEFORE producing output
 *      (reserve-first), so a ledger failure can't leak info.
 *   4. Returns a structured refusal, never an opaque error or a
 *      fallback unsafe value.
 *
 * This file contains business logic only; adapters for the ports
 * (Postgres ledger, Memgraph tenant source, crypto-PRNG noise) live
 * in separate files and are wired at the composition root.
 */

import type {
  AggregateOutcome,
  AggregateQuery,
  AggregateResult,
  DPMechanism,
  NoiseSource,
  PlatformAuthContext,
  PlatformBudgetLedger,
  TenantAggregateSource,
} from '../types.js';
import { PrivacyBudgetExhaustedError } from '../types.js';

export interface DpAggregatorDeps {
  readonly tenantSource: TenantAggregateSource;
  readonly ledger: PlatformBudgetLedger;
  readonly noise: NoiseSource;
  readonly clock?: () => Date;
}

export interface DpAggregator {
  aggregate(
    query: AggregateQuery,
    ctx: PlatformAuthContext,
  ): Promise<AggregateOutcome>;
}

export function createDpAggregator(deps: DpAggregatorDeps): DpAggregator {
  const now = deps.clock ?? (() => new Date());

  return {
    async aggregate(query, ctx): Promise<AggregateOutcome> {
      assertPlatformAuth(ctx);

      // 1. Who is in the slice?
      const eligible = await deps.tenantSource.eligibleTenants(query.slice);
      if (eligible.length === 0) {
        return {
          kind: 'refused',
          reason: 'slice_empty',
          detail: 'no tenants match the slice',
        };
      }
      if (eligible.length < query.kMin) {
        return {
          kind: 'refused',
          reason: 'k_anonymity_not_met',
          detail: `slice has ${eligible.length} tenants, k_min=${query.kMin}`,
        };
      }

      // 2. Reserve privacy budget BEFORE reading any tenant values.
      //    If the reserve fails, we've leaked no information.
      const delta = query.mechanism.kind === 'gaussian' ? query.mechanism.delta : 0;
      try {
        await deps.ledger.reserve({
          epsilon: query.mechanism.epsilon,
          delta,
        });
      } catch (err) {
        if (err instanceof PrivacyBudgetExhaustedError) {
          return {
            kind: 'refused',
            reason: 'platform_budget_exhausted',
            detail: err.message,
          };
        }
        throw err;
      }

      // 3. Fetch per-tenant contributions in parallel. Each source
      //    returns an array of numbers (e.g. 0/1 per lease for a
      //    rate; raw days for a duration metric). We clip to the
      //    sensitivity range defensively even though each source is
      //    contracted to do so.
      const contributions = await Promise.all(
        eligible.map((tenantId) =>
          deps.tenantSource.contributionsFor({
            tenantId,
            statistic: query.statistic,
            slice: query.slice,
          }),
        ),
      );

      const rawValue = combineContributions(contributions, query.mechanism);
      const noisedValue = applyNoise(rawValue, query.mechanism, deps.noise);

      const result: AggregateResult = {
        statistic: query.statistic,
        slice: query.slice,
        noisedValue,
        contributingTenants: eligible.length,
        privacyCost: query.mechanism.epsilon,
        privacyDelta: query.mechanism.kind === 'gaussian' ? query.mechanism.delta : null,
        generatedAt: now().toISOString(),
      };
      return { kind: 'published', ...result };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Combining — per-tenant mean of means, so a tenant with 10,000 units
// doesn't dominate a tenant with 50. Each tenant contributes a single
// bounded value in [0, sensitivity].
// ─────────────────────────────────────────────────────────────────────

function combineContributions(
  perTenant: ReadonlyArray<ReadonlyArray<number>>,
  mechanism: DPMechanism,
): number {
  if (perTenant.length === 0) return 0;
  const perTenantMeans: number[] = [];
  for (const values of perTenant) {
    if (values.length === 0) continue;
    let sum = 0;
    for (const v of values) {
      // Clamp defensively to the sensitivity range
      const clipped = Math.max(-mechanism.sensitivity, Math.min(mechanism.sensitivity, v));
      sum += clipped;
    }
    perTenantMeans.push(sum / values.length);
  }
  if (perTenantMeans.length === 0) return 0;
  let outer = 0;
  for (const m of perTenantMeans) outer += m;
  return outer / perTenantMeans.length;
}

function applyNoise(
  rawValue: number,
  mechanism: DPMechanism,
  noise: NoiseSource,
): number {
  if (mechanism.kind === 'laplace') {
    const scale = mechanism.sensitivity / mechanism.epsilon;
    return rawValue + noise.laplace(scale);
  }
  // Gaussian
  const sigma =
    (mechanism.sensitivity *
      Math.sqrt(2 * Math.log(1.25 / mechanism.delta))) /
    mechanism.epsilon;
  return rawValue + noise.gaussian(sigma);
}

function assertPlatformAuth(ctx: PlatformAuthContext): void {
  if (ctx.kind !== 'platform') {
    throw new Error('graph-privacy: aggregate() requires a platform AuthContext');
  }
}
