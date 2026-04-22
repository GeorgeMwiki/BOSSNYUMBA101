import { NextResponse } from 'next/server';

/**
 * Privacy-budget readout.
 *
 * TODO (graph-privacy wiring): call the platform DP-accountant in
 * `@bossnyumba/graph-privacy` to read the current ε spend in the
 * rolling window. Until that service is reachable, respond 503 so the
 * UI renders a degraded-state card — never a mock ε value.
 */
export function GET() {
  return NextResponse.json(
    { error: 'graph-privacy accountant not wired' },
    { status: 503 },
  );
}
