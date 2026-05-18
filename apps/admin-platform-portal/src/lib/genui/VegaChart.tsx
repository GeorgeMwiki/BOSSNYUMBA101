'use client';

/**
 * 1. chart-vega — Vega-Lite v6 chart renderer.
 *
 * Anti-patterns enforced:
 *   - ajv-validate every Vega-Lite spec BEFORE render (R2)
 *   - render only on complete `tool-output-available` payload (R2)
 *   - never stream chart spec piece-by-piece (R2)
 *
 * Dependencies (declared in package.json, installed at integration):
 *   - react-vega ^8.0.0
 *   - vega-lite ^6.4.3
 *   - vega ^6.2.0
 *   - vega-embed ^7.1.0
 *
 * Phase D11 (2026-05-17): bumped from vega 5 → 6 + react-vega 7 → 8 +
 * vega-embed 6 → 7 + vega-lite 5 → 6 — closes GHSA-7f2v-3qq3-vvjf
 * (vega XSS via expressions in VEGA_DEBUG env) and GHSA-m9rg-mr6g-75gm
 * (vega-functions XSS via setdata). The declarative
 * `data: { values: props.data }` injection pattern below is unchanged
 * across the major bump.
 *
 * Loading strategy: dynamic + ssr:false. The Vega bundle is ~280KB
 * and adds nothing to first-paint on routes without a chart.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import type { AgUiUiPartByKind } from './types';
import { Frame, GenUiError } from './Frame';
import { ChartVegaPartSchema } from './schemas';
import { validateVegaSpec, quickVegaShapeCheck } from './validate';

// Lazy import — typed as `any` because the dep is not yet installed
// during typecheck. Once `pnpm install` runs, the real types win.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VegaLite = dynamic<any>(
  // @ts-ignore — module added at integration time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => import('react-vega').then((m: any) => m.VegaLite),
  { ssr: false, loading: () => <span className="text-xs text-muted-foreground">loading chart…</span> },
);

export type VegaChartProps = AgUiUiPartByKind<'chart-vega'>;

export function VegaChart(props: VegaChartProps): JSX.Element {
  const parsed = ChartVegaPartSchema.safeParse(props);
  if (!parsed.success) {
    return (
      <GenUiError
        kind="chart-vega"
        message={parsed.error.issues.map((i) => i.message).join('; ')}
      />
    );
  }

  const [ajvOk, setAjvOk] = useState<null | { ok: boolean; errors: ReadonlyArray<string> }>(
    null,
  );

  useEffect(() => {
    let alive = true;
    void validateVegaSpec(props.spec).then((res) => {
      if (alive) setAjvOk(res);
    });
    return () => {
      alive = false;
    };
  }, [props.spec]);

  if (!quickVegaShapeCheck(props.spec)) {
    return (
      <GenUiError
        kind="chart-vega"
        message="spec missing mark / encoding / layer composition operator"
      />
    );
  }

  if (ajvOk && !ajvOk.ok) {
    return (
      <GenUiError
        kind="chart-vega"
        message={`invalid Vega-Lite spec: ${ajvOk.errors.slice(0, 3).join('; ')}`}
      />
    );
  }

  // Inject `data` into the spec as inline values so the LLM doesn't
  // have to know about Vega's data-source URL conventions.
  const fullSpec = {
    ...props.spec,
    data: { values: props.data },
    width: 'container',
  };

  return (
    <Frame kind="chart-vega" {...(props.title ? { title: props.title } : {})}>
      <div className="w-full" style={{ minHeight: 220 }}>
        {ajvOk?.ok ? (
          <VegaLite spec={fullSpec} actions={false} renderer="canvas" />
        ) : (
          <span className="text-xs text-muted-foreground">validating spec…</span>
        )}
      </div>
    </Frame>
  );
}
