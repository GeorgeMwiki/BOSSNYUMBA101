/**
 * Wave-D no-fabrication detector for the dashboard "Revenue trend" chart.
 *
 * The chart used to be fed by a hardcoded empty array
 * (`const revenueTrendData ... = []`), so it was born-dark and could never
 * show real data even once the backend series landed. These source-level
 * guards lock in the fix:
 *   1. `revenueTrendData` is no longer a bare hardcoded `[]`.
 *   2. It is derived from the live dashboard payload's `revenueTrend` series.
 *   3. The honest empty-state (`revenueTrendUnavailable`) is still rendered
 *      when the series is absent, instead of an empty chart.
 *
 * Source-level rather than render-level because the full DashboardPage pulls
 * the entire provider tree (react-router, react-query, recharts,
 * design-system); these assertions detect a regression without that weight.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardSource = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../DashboardPage.tsx',
  ),
  'utf8',
);

describe('DashboardPage revenue trend — no born-dark fabrication', () => {
  it('does not hardcode revenueTrendData to an empty array literal', () => {
    // The exact fabrication-shaped line that made the chart born-dark.
    expect(dashboardSource).not.toMatch(
      /const\s+revenueTrendData\s*:[^=]*=\s*\[\s*\]\s*;/,
    );
  });

  it('derives the revenue series from the live dashboard payload', () => {
    expect(dashboardSource).toMatch(/revenueTrend/);
    expect(dashboardSource).toMatch(/revenueSeries/);
    // The series is mapped into the chart's { month, revenue } shape.
    expect(dashboardSource).toMatch(/revenue:\s*point\.value/);
  });

  it('still renders an honest empty-state when no revenue data is available', () => {
    expect(dashboardSource).toMatch(/revenueTrendData\.length\s*>\s*0/);
    expect(dashboardSource).toMatch(/revenueTrendUnavailable/);
  });
});
