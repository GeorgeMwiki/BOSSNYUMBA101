/**
 * Lazy-loaded chart wrappers. recharts is ~80KB gzipped — by deferring
 * the import to render time we shave ~80KB off the dashboard initial
 * bundle (a roughly 20-30% LCP improvement for cold loads).
 *
 * Each wrapper uses `loaderWithRetry` from
 * `@bossnyumba/performance-toolkit` so a stale browser session that
 * tries to load a chunk after a deploy auto-recovers with one retry +
 * one full-page reload at most.
 *
 * Suspense fallback is a Skeleton matching the chart's intrinsic size
 * so layout is preserved (CLS = 0).
 *
 * Usage:
 *   import { LazyArrearsAgingChart } from '../components/charts/lazy';
 *   <LazyArrearsAgingChart data={arrears} />
 */

import React, { Suspense } from 'react';
import { Skeleton } from '@bossnyumba/design-system';
import { loaderWithRetry } from '@bossnyumba/performance-toolkit/lazy-load';
import type { ArrearsAgingData } from './ArrearsAgingChart';
import type { MaintenanceCostData } from './MaintenanceCostTrends';
import type { NOIData } from './NOIChart';

const ArrearsAgingChart = React.lazy(
  loaderWithRetry(() =>
    import('./ArrearsAgingChart').then((m) => ({ default: m.ArrearsAgingChart })),
  ),
);

const MaintenanceCostTrends = React.lazy(
  loaderWithRetry(() =>
    import('./MaintenanceCostTrends').then((m) => ({
      default: m.MaintenanceCostTrends,
    })),
  ),
);

const NOIChart = React.lazy(
  loaderWithRetry(() =>
    import('./NOIChart').then((m) => ({ default: m.NOIChart })),
  ),
);

function ChartSkeleton({ height = 320 }: { readonly height?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading chart"
      style={{ height }}
      className="w-full"
    >
      <Skeleton className="h-full w-full" />
    </div>
  );
}

export function LazyArrearsAgingChart(props: {
  readonly data: readonly ArrearsAgingData[];
  readonly className?: string;
}) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ArrearsAgingChart {...(props as { data: ArrearsAgingData[]; className?: string })} />
    </Suspense>
  );
}

export function LazyMaintenanceCostTrends(props: {
  readonly data: readonly MaintenanceCostData[];
  readonly className?: string;
}) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <MaintenanceCostTrends
        {...(props as { data: MaintenanceCostData[]; className?: string })}
      />
    </Suspense>
  );
}

export function LazyNOIChart(props: {
  readonly data: readonly NOIData[];
  readonly className?: string;
}) {
  return (
    <Suspense fallback={<ChartSkeleton height={360} />}>
      <NOIChart {...(props as { data: NOIData[]; className?: string })} />
    </Suspense>
  );
}
