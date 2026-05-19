import { describe, expect, it } from 'vitest';
import { createCollectorSink, fanOut } from './sink';
import { cellEdited } from './events';
import { ctx } from '../__tests__/fixtures';

const ARGS = { actor: 'owner' as const, context: ctx() };

describe('createCollectorSink', () => {
  it('captures emitted events', async () => {
    const sink = createCollectorSink();
    const ev = cellEdited(ARGS, {
      rowKey: 'r-1',
      columnId: 'amount',
      previousValue: 1,
      nextValue: 2,
    });
    await sink.emit(ev);
    expect(sink.events).toEqual([ev]);
  });

  it('drains the buffer and returns the queued events', async () => {
    const sink = createCollectorSink();
    await sink.emit(cellEdited(ARGS, { rowKey: 'a', columnId: 'x', previousValue: 1, nextValue: 2 }));
    await sink.emit(cellEdited(ARGS, { rowKey: 'b', columnId: 'x', previousValue: 1, nextValue: 2 }));
    expect(sink.drain()).toHaveLength(2);
    expect(sink.events).toEqual([]);
  });

  it('resets without returning the buffer', async () => {
    const sink = createCollectorSink();
    await sink.emit(cellEdited(ARGS, { rowKey: 'a', columnId: 'x', previousValue: 1, nextValue: 2 }));
    sink.reset();
    expect(sink.events).toEqual([]);
  });
});

describe('fanOut', () => {
  it('emits to all sinks', async () => {
    const a = createCollectorSink();
    const b = createCollectorSink();
    const combined = fanOut(a, b);
    await combined.emit(
      cellEdited(ARGS, { rowKey: 'a', columnId: 'x', previousValue: 1, nextValue: 2 }),
    );
    expect(a.events).toHaveLength(1);
    expect(b.events).toHaveLength(1);
  });
});
