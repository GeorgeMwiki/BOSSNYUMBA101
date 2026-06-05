/**
 * Comparison framework — never let a raw number speak alone.
 *
 * Given a landlord metric value, return three baselines:
 *
 *   - HISTORICAL: same tenant, 30d / 90d / YoY.
 *   - PEER COHORT: anonymized aggregate (p25/p50/p75) across tenants in
 *     the same property-class + market bucket. Read from a
 *     `peer_cohort_aggregates` table (future migration).
 *   - EXTERNAL BENCHMARK: market-rent index, central-bank FX, statutory
 *     rental-income tax rate, local-authority pass rate, etc. Read from
 *     an `external_benchmarks` table (future migration).
 *
 * Returns `{tenant, historical, peer, benchmark, delta, percentile}`.
 * If a baseline is missing from the database, the slot returns `null`
 * with a `note: 'awaiting seed'` so the brain renders an honest "no
 * comparison available" instead of crashing or fabricating.
 */

export interface ComparisonScope {
  readonly tenantId: string;
  readonly cohortKey?: string;
  readonly metricId: string;
}

export interface HistoricalBaseline {
  readonly day30: number | null;
  readonly day90: number | null;
  readonly yoy: number | null;
  readonly note?: string;
}

export interface PeerBaseline {
  readonly cohortKey: string;
  readonly p25: number | null;
  readonly p50: number | null;
  readonly p75: number | null;
  readonly sampleSize: number;
  readonly note?: string;
}

export interface BenchmarkBaseline {
  readonly source: string;
  readonly value: number | null;
  readonly asOf: string | null;
  readonly note?: string;
}

export interface ComparisonResult {
  readonly metricId: string;
  readonly tenant: number;
  readonly historical: HistoricalBaseline | null;
  readonly peer: PeerBaseline | null;
  readonly benchmark: BenchmarkBaseline | null;
  readonly delta: {
    readonly vsDay30: number | null;
    readonly vsDay90: number | null;
    readonly vsYoy: number | null;
    readonly vsPeerP50: number | null;
    readonly vsBenchmark: number | null;
  };
  readonly percentile: number | null;
  readonly note?: string;
}

export interface HistoricalReader {
  read(scope: ComparisonScope): Promise<HistoricalBaseline | null>;
}

export interface PeerReader {
  read(scope: ComparisonScope): Promise<PeerBaseline | null>;
}

export interface BenchmarkReader {
  read(scope: ComparisonScope): Promise<BenchmarkBaseline | null>;
}

export interface ComparisonReaders {
  readonly historical?: HistoricalReader;
  readonly peer?: PeerReader;
  readonly benchmark?: BenchmarkReader;
}

export interface CompareInput {
  readonly metricId: string;
  readonly tenant: number;
  readonly scope: ComparisonScope;
  readonly readers: ComparisonReaders;
}

const NULL_HISTORICAL: HistoricalBaseline = Object.freeze({
  day30: null,
  day90: null,
  yoy: null,
  note: 'awaiting seed',
});

/**
 * Compare a landlord value against historical, peer, and benchmark
 * baselines. Always returns a result; missing baselines surface as
 * `null` with a `note: 'awaiting seed'`.
 */
export async function compare(input: CompareInput): Promise<ComparisonResult> {
  const historical = await readSafely<HistoricalBaseline>(
    input.readers.historical,
    input.scope,
  );
  const peer = await readSafely<PeerBaseline>(input.readers.peer, input.scope);
  const benchmark = await readSafely<BenchmarkBaseline>(
    input.readers.benchmark,
    input.scope,
  );

  const histResolved = historical ?? NULL_HISTORICAL;

  const delta = {
    vsDay30: percentDelta(input.tenant, histResolved.day30),
    vsDay90: percentDelta(input.tenant, histResolved.day90),
    vsYoy: percentDelta(input.tenant, histResolved.yoy),
    vsPeerP50: percentDelta(input.tenant, peer?.p50 ?? null),
    vsBenchmark: percentDelta(input.tenant, benchmark?.value ?? null),
  } as const;

  const percentile = computePercentile(input.tenant, peer);

  const result: ComparisonResult = Object.freeze({
    metricId: input.metricId,
    tenant: input.tenant,
    historical: historical ?? NULL_HISTORICAL,
    peer: peer ?? null,
    benchmark: benchmark ?? null,
    delta: Object.freeze(delta),
    percentile,
    ...(historical === null || peer === null || benchmark === null
      ? { note: 'awaiting seed' }
      : {}),
  });

  return result;
}

async function readSafely<T>(
  reader: { read(scope: ComparisonScope): Promise<T | null> } | undefined,
  scope: ComparisonScope,
): Promise<T | null> {
  if (!reader) return null;
  try {
    return await reader.read(scope);
  } catch {
    return null;
  }
}

function percentDelta(tenant: number, baseline: number | null): number | null {
  if (baseline === null || baseline === 0) return null;
  return (tenant - baseline) / baseline;
}

function computePercentile(
  tenant: number,
  peer: PeerBaseline | null,
): number | null {
  if (!peer) return null;
  const { p25, p50, p75 } = peer;
  if (p25 === null || p50 === null || p75 === null) return null;
  if (tenant <= p25) {
    if (p25 === 0) return 0.25;
    return Math.max(0.01, 0.25 * (tenant / p25));
  }
  if (tenant <= p50) {
    if (p50 === p25) return 0.5;
    return 0.25 + (0.25 * (tenant - p25)) / (p50 - p25);
  }
  if (tenant <= p75) {
    if (p75 === p50) return 0.75;
    return 0.5 + (0.25 * (tenant - p50)) / (p75 - p50);
  }
  return Math.min(0.99, 0.75 + 0.25 * (tenant / p75 - 1));
}
