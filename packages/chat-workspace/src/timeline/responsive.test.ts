import { describe, expect, it } from 'vitest';
import { COLLAPSE_BREAKPOINT_PX, shouldCollapseOnNarrow, summarisePart } from './responsive';
import { chartPart, mapPart, tablePart, kpiPart, dataflowPart } from '../__tests__/fixtures';

describe('shouldCollapseOnNarrow', () => {
  it('collapses charts on narrow viewports', () => {
    expect(shouldCollapseOnNarrow(chartPart())).toBe(true);
  });

  it('collapses tables on narrow viewports', () => {
    expect(shouldCollapseOnNarrow(tablePart())).toBe(true);
  });

  it('collapses maps on narrow viewports', () => {
    expect(shouldCollapseOnNarrow(mapPart())).toBe(true);
  });

  it('collapses dataflow diagrams on narrow viewports', () => {
    expect(shouldCollapseOnNarrow(dataflowPart())).toBe(true);
  });

  it('does NOT collapse KPI grids (already compact)', () => {
    expect(shouldCollapseOnNarrow(kpiPart())).toBe(false);
  });
});

describe('summarisePart', () => {
  it('summarises a chart with title', () => {
    expect(summarisePart(chartPart({ title: 'Revenue chart' }))).toBe('Revenue chart');
  });

  it('summarises a chart without title', () => {
    expect(summarisePart({ ...chartPart(), title: undefined })).toContain('Chart');
  });

  it('summarises a table with row and column counts', () => {
    expect(summarisePart({ ...tablePart(), title: undefined })).toMatch(/2 rows × 3 cols/);
  });

  it('summarises a KPI grid by tile count', () => {
    expect(summarisePart({ ...kpiPart(), title: undefined })).toMatch(/3 KPI tiles/);
  });
});

describe('COLLAPSE_BREAKPOINT_PX', () => {
  it('is the documented 600px', () => {
    expect(COLLAPSE_BREAKPOINT_PX).toBe(600);
  });
});
