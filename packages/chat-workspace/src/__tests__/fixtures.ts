import type { AgUiUiPart, AgUiUiPartByKind } from '@bossnyumba/genui';
import type { Block, GenUiBlock, InteractionContext, TextBlock, Turn } from '../types';

export function ctx(overrides: Partial<InteractionContext> = {}): InteractionContext {
  return {
    conversationId: 'conv-test',
    turnId: 'turn-1',
    blockId: 'blk-1',
    originatingPartKind: 'data-table',
    ...overrides,
  };
}

export function textBlock(id: string, markdown: string): TextBlock {
  return { kind: 'text', id, markdown };
}

export function genUiBlock(id: string, part: AgUiUiPart, anchor?: string): GenUiBlock {
  return anchor !== undefined ? { kind: 'genui', id, part, anchor } : { kind: 'genui', id, part };
}

export function turn(
  id: string,
  role: Turn['role'],
  blocks: ReadonlyArray<Block>,
  timestamp = '2026-05-19T10:00:00Z',
): Turn {
  return { id, role, timestamp, blocks };
}

export function tablePart(
  overrides: Partial<AgUiUiPartByKind<'data-table'>> = {},
): AgUiUiPartByKind<'data-table'> {
  return {
    kind: 'data-table',
    title: 'Proposed Mapping',
    columns: [
      { id: 'a', header: 'Source', accessorKey: 'a' },
      { id: 'b', header: 'Target', accessorKey: 'b' },
      { id: 'c', header: 'Amount', accessorKey: 'c', format: 'currency', currency: 'KES' },
    ],
    rows: [
      { a: 'A', b: 'rent', c: 12000 },
      { a: 'B', b: 'service', c: 3000 },
    ],
    ...overrides,
  };
}

export function chartPart(
  overrides: Partial<AgUiUiPartByKind<'chart-vega'>> = {},
): AgUiUiPartByKind<'chart-vega'> {
  return {
    kind: 'chart-vega',
    title: 'Cashflow',
    spec: {},
    data: [
      { month: '2026-01', amount: 12000 },
      { month: '2026-02', amount: 14000 },
      { month: '2026-03', amount: 11000 },
    ],
    ...overrides,
  };
}

export function mapPart(
  overrides: Partial<AgUiUiPartByKind<'map'>> = {},
): AgUiUiPartByKind<'map'> {
  return {
    kind: 'map',
    title: 'Property',
    center: [36.8219, -1.2921],
    zoom: 10,
    markers: [{ position: [36.8219, -1.2921], popup: 'HQ' }],
    ...overrides,
  };
}

export function dataflowPart(
  overrides: Partial<AgUiUiPartByKind<'dataflow-diagram'>> = {},
): AgUiUiPartByKind<'dataflow-diagram'> {
  return {
    kind: 'dataflow-diagram',
    title: 'Onboarding workflow',
    nodes: [
      { id: 'n1', label: 'Apply', kind: 'source' },
      { id: 'n2', label: 'KYC', kind: 'transform' },
      { id: 'n3', label: 'Approve', kind: 'decision' },
      { id: 'n4', label: 'Activate', kind: 'sink' },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4' },
    ],
    ...overrides,
  };
}

export function kpiPart(): AgUiUiPartByKind<'kpi-grid'> {
  return {
    kind: 'kpi-grid',
    title: 'Snapshot',
    tiles: [
      { label: 'Revenue', value: 1_200_000, format: 'currency', currency: 'KES' },
      { label: 'Occupancy', value: 92, format: 'percent' },
      { label: 'Tickets open', value: 7, format: 'number' },
    ],
  };
}
