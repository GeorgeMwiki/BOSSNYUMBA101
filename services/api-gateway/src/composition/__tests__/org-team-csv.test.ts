/**
 * parseStaffCsv unit tests (Wave ORG-ADMIN-TOOLS).
 *
 * Verifies the RFC-4180 parsing, required-column mapping, optional-column
 * extraction, per-row rejection collection, and the row-cap guard ported
 * from LitFin's bulk-ingest-employees-csv.ts.
 */
import { describe, expect, it } from 'vitest';

import { parseStaffCsv, parseCsv, BULK_MAX_ROWS } from '../org-team-csv.js';

describe('parseCsv (RFC-4180)', () => {
  it('handles quoted fields with commas and doubled quotes', () => {
    const rows = parseCsv('name,role\n"Doe, Jane","Lead ""Caretaker"""');
    expect(rows).toEqual([
      ['name', 'role'],
      ['Doe, Jane', 'Lead "Caretaker"'],
    ]);
  });

  it('skips wholly-empty trailing rows', () => {
    const rows = parseCsv('name,role\nAsha,caretaker\n\n');
    expect(rows).toHaveLength(2);
  });
});

describe('parseStaffCsv', () => {
  it('rejects a CSV with no data rows', () => {
    const res = parseStaffCsv('name,role');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('EMPTY');
  });

  it('rejects a header missing required columns', () => {
    const res = parseStaffCsv('first,last\nAsha,Mwamba');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('MISSING_REQUIRED_COLUMNS');
  });

  it('parses required + optional columns and extracts contact metadata', () => {
    const csv = [
      'name,role,hire_date,phone,email,manager_name,notes',
      'Asha Mwamba,caretaker,2026-01-15,+255712345678,asha@example.com,Boss,Reliable',
    ].join('\n');
    const res = parseStaffCsv(csv);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.totalDataRows).toBe(1);
      expect(res.parsedRows).toHaveLength(1);
      const row = res.parsedRows[0]!;
      expect(row.fullName).toBe('Asha Mwamba');
      expect(row.role).toBe('caretaker');
      expect(row.managerName).toBe('Boss');
      expect(row.metadata.phone).toBe('+255712345678');
      expect(row.metadata.email).toBe('asha@example.com');
      expect(row.metadata.notes).toBe('Reliable');
    }
  });

  it('drops malformed contact values but keeps the row', () => {
    const csv = [
      'name,role,phone,email',
      'Juma,groundskeeper,not-a-phone,not-an-email',
    ].join('\n');
    const res = parseStaffCsv(csv);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.parsedRows[0]!.metadata.phone).toBeUndefined();
      expect(res.parsedRows[0]!.metadata.email).toBeUndefined();
    }
  });

  it('collects rejections (empty role, bad date) by line number while keeping good rows', () => {
    const csv = [
      'name,role,hire_date',
      'Asha,caretaker,2026-01-15', // line 2 — ok
      'NoRole,,2026-01-15', // line 3 — rejected (empty role)
      'BadDate,accountant,not-a-date', // line 4 — rejected (bad date)
    ].join('\n');
    const res = parseStaffCsv(csv);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.parsedRows).toHaveLength(1);
      expect(res.preInsertOutcomes).toHaveLength(2);
      const lines = res.preInsertOutcomes.map((o) => o.line).sort();
      expect(lines).toEqual([3, 4]);
      for (const o of res.preInsertOutcomes) expect(o.status).toBe('rejected');
    }
  });

  it('fails ALL_REJECTED when every data row is invalid', () => {
    const res = parseStaffCsv('name,role\n,caretaker\n,accountant');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('ALL_REJECTED');
      expect(res.outcomes).toHaveLength(2);
    }
  });

  it('rejects more than the row cap', () => {
    const header = 'name,role';
    const rows = Array.from(
      { length: BULK_MAX_ROWS + 1 },
      (_v, i) => `Person${i},caretaker`,
    );
    const res = parseStaffCsv([header, ...rows].join('\n'));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('TOO_MANY_ROWS');
  });
});
