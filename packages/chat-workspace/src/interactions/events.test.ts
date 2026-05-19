import { describe, expect, it } from 'vitest';
import {
  cellEdited,
  chartFilterApplied,
  chartZoom,
  nextEventId,
  nodeEdited,
  polygonDrawn,
  rowApproved,
  rowRejected,
  selectionChanged,
} from './events';
import { ctx } from '../__tests__/fixtures';

const ARGS = { actor: 'owner' as const, context: ctx() };

describe('interaction event builders', () => {
  it('cellEdited carries the previous and next values', () => {
    const ev = cellEdited(ARGS, {
      rowKey: 'r-1',
      columnId: 'amount',
      previousValue: 100,
      nextValue: 120,
    });
    expect(ev.type).toBe('blackboard.interaction');
    expect(ev.payload).toMatchObject({
      kind: 'cell-edited',
      rowKey: 'r-1',
      columnId: 'amount',
      previousValue: 100,
      nextValue: 120,
    });
  });

  it('nodeEdited captures rename + edge deltas', () => {
    const ev = nodeEdited(ARGS, {
      nodeId: 'n-1',
      previousLabel: 'Apply',
      nextLabel: 'Submit',
      addedEdges: [{ from: 'n-1', to: 'n-2' }],
    });
    expect(ev.payload).toMatchObject({
      kind: 'node-edited',
      nodeId: 'n-1',
      previousLabel: 'Apply',
      nextLabel: 'Submit',
    });
  });

  it('polygonDrawn emits a closed GeoJSON ring', () => {
    const ring: ReadonlyArray<readonly [number, number]> = [
      [36.82, -1.29],
      [36.83, -1.29],
      [36.83, -1.30],
      [36.82, -1.29],
    ];
    const ev = polygonDrawn(ARGS, { ring, closed: true });
    expect(ev.payload).toMatchObject({ kind: 'polygon-drawn', closed: true });
    expect((ev.payload as { ring: typeof ring }).ring).toHaveLength(4);
  });

  it('rowApproved tags the approver', () => {
    const ev = rowApproved(ARGS, { rowKey: 'r-1', approvedBy: 'owner' });
    expect(ev.payload).toMatchObject({ kind: 'row-approved', rowKey: 'r-1', approvedBy: 'owner' });
  });

  it('rowRejected can carry an optional reason', () => {
    const ev = rowRejected(ARGS, { rowKey: 'r-1', reason: 'duplicate' });
    expect(ev.payload).toMatchObject({ kind: 'row-rejected', reason: 'duplicate' });
  });

  it('selectionChanged carries the full key set', () => {
    const ev = selectionChanged(ARGS, { selectedKeys: ['a', 'b'] });
    expect(ev.payload).toMatchObject({ kind: 'selection-changed', selectedKeys: ['a', 'b'] });
  });

  it('chartZoom carries the x-domain', () => {
    const ev = chartZoom(ARGS, { domainX: [0, 30] });
    expect(ev.payload).toMatchObject({ kind: 'chart-zoom', domainX: [0, 30] });
  });

  it('chartFilterApplied carries the field/operator/value tuple', () => {
    const ev = chartFilterApplied(ARGS, { field: 'month', operator: 'eq', value: '2026-04' });
    expect(ev.payload).toMatchObject({
      kind: 'chart-filter-applied',
      field: 'month',
      operator: 'eq',
      value: '2026-04',
    });
  });

  it('events have distinct ids when generated in succession', () => {
    const a = nextEventId();
    const b = nextEventId();
    expect(a).not.toBe(b);
  });

  it('every event records the actor and full interaction context', () => {
    const ev = cellEdited(ARGS, {
      rowKey: 'r-1',
      columnId: 'amount',
      previousValue: 100,
      nextValue: 120,
    });
    expect(ev.actor).toBe('owner');
    expect(ev.context.conversationId).toBe('conv-test');
    expect(ev.context.turnId).toBe('turn-1');
    expect(ev.context.blockId).toBe('blk-1');
  });
});
