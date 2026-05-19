/**
 * EmployeeTableView unit tests.
 */

import { describe, expect, it } from 'vitest';
import {
  EmployeeTableView,
  type EmployeeData,
  type EmployeeRow,
} from '../views/employee-table-view.js';
import { ownerCustomer } from '../types/principal.js';
import type { RenderContext } from '../types/tab-view.js';

function ctx(): RenderContext {
  return {
    principal: ownerCustomer({ principalId: 'p1', tenantId: 't1' }),
    entityType: 'employee',
  };
}

function row(over: Partial<EmployeeRow>): EmployeeRow {
  return {
    id: 'e1',
    name: 'Asha',
    role: 'caretaker',
    properties_managed: 4,
    tickets_closed_30d: 12,
    avg_ticket_resolution_hours: 3.5,
    rating: 4.7,
    last_activity_at: '2026-05-19T08:00:00.000Z',
    ...over,
  };
}

describe('EmployeeTableView.validateQuery', () => {
  it('accepts undefined and returns a defaulted query', () => {
    const r = EmployeeTableView.validateQuery(undefined, ctx());
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.query).toEqual({
        limit: 25,
        sortBy: 'tickets_closed_30d',
        sortDir: 'desc',
      });
  });

  it('accepts null', () => {
    const r = EmployeeTableView.validateQuery(null, ctx());
    expect(r.ok).toBe(true);
  });

  it('rejects non-object queries', () => {
    const r = EmployeeTableView.validateQuery('hello', ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe('invalid-shape');
  });

  it('rejects non-numeric limit', () => {
    const r = EmployeeTableView.validateQuery({ limit: 'ten' }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe('invalid-shape');
  });

  it('rejects negative limit', () => {
    const r = EmployeeTableView.validateQuery({ limit: -5 }, ctx());
    expect(r.ok).toBe(false);
  });

  it('rejects limit over the maximum', () => {
    const r = EmployeeTableView.validateQuery({ limit: 9999 }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe('limit-exceeded');
  });

  it('rejects unknown sortBy field', () => {
    const r = EmployeeTableView.validateQuery({ sortBy: 'unknown' }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe('unknown-field');
  });

  it('accepts known sortBy fields', () => {
    for (const s of ['name', 'tickets_closed_30d', 'avg_ticket_resolution_hours', 'rating']) {
      const r = EmployeeTableView.validateQuery({ sortBy: s }, ctx());
      expect(r.ok, `sortBy=${s}`).toBe(true);
    }
  });

  it('rejects invalid sortDir', () => {
    const r = EmployeeTableView.validateQuery({ sortDir: 'sideways' }, ctx());
    expect(r.ok).toBe(false);
  });

  it('rejects out-of-range minRating', () => {
    const r1 = EmployeeTableView.validateQuery({ minRating: 6 }, ctx());
    expect(r1.ok).toBe(false);
    const r2 = EmployeeTableView.validateQuery({ minRating: -1 }, ctx());
    expect(r2.ok).toBe(false);
  });
});

describe('EmployeeTableView.renderToBlocks', () => {
  it('returns an info markdown card when rows are empty', () => {
    const blocks = EmployeeTableView.renderToBlocks({ rows: [] }, ctx());
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.kind).toBe('markdown-card');
  });

  it('renders a data-table block with 6 columns', () => {
    const data: EmployeeData = { rows: [row({}), row({ id: 'e2' })] };
    const blocks = EmployeeTableView.renderToBlocks(data, ctx());
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.kind).toBe('data-table');
    const cols = (blocks[0] as unknown as { columns: { id: string }[] }).columns;
    expect(cols.length).toBe(6);
    expect(cols.map((c) => c.id)).toEqual([
      'name',
      'role',
      'properties_managed',
      'tickets_closed_30d',
      'avg_ticket_resolution_hours',
      'rating',
    ]);
  });

  it('passes through the row data unchanged', () => {
    const data: EmployeeData = { rows: [row({ name: 'Brenda' }), row({ name: 'Charles', id: 'e2' })] };
    const blocks = EmployeeTableView.renderToBlocks(data, ctx());
    const rows = (blocks[0] as unknown as { rows: { name: string }[] }).rows;
    expect(rows.map((r) => r.name)).toEqual(['Brenda', 'Charles']);
  });

  it('applies a saved preference sort', () => {
    const data: EmployeeData = {
      rows: [row({ name: 'Charles', tickets_closed_30d: 5 }), row({ name: 'Asha', tickets_closed_30d: 20 })],
    };
    const c: RenderContext = {
      ...ctx(),
      preference: {
        id: 'p1',
        entityType: 'employee',
        viewKey: 'employee.roster.table',
        scope: 'conversation',
        sortBy: [{ field: 'name', direction: 'asc' }],
        updatedAt: '2026-05-19T00:00:00.000Z',
      },
    };
    const blocks = EmployeeTableView.renderToBlocks(data, c);
    const rows = (blocks[0] as unknown as { rows: { name: string }[] }).rows;
    expect(rows.map((r) => r.name)).toEqual(['Asha', 'Charles']);
  });

  it('applies a saved preference filter', () => {
    const data: EmployeeData = {
      rows: [
        row({ name: 'A', rating: 5 }),
        row({ name: 'B', rating: 3 }),
        row({ name: 'C', rating: 4.8, id: 'e3' }),
      ],
    };
    const c: RenderContext = {
      ...ctx(),
      preference: {
        id: 'p1',
        entityType: 'employee',
        viewKey: 'employee.roster.table',
        scope: 'tenant',
        filterBy: [{ field: 'rating', op: 'gte', value: 4.5 }],
        updatedAt: '2026-05-19T00:00:00.000Z',
      },
    };
    const blocks = EmployeeTableView.renderToBlocks(data, c);
    const rows = (blocks[0] as unknown as { rows: { name: string }[] }).rows;
    expect(rows.map((r) => r.name)).toEqual(['A', 'C']);
  });
});
