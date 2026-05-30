/**
 * Tests for `compose-prompt-with-person-layer.ts` — the brain wire-in
 * seam that overlays the federated PKB on top of tenant-scoped recall.
 *
 * Coverage targets:
 *   - empty currentPersonId → empty result (short-circuit, no DB hit)
 *   - empty currentTenantId → empty result (degraded, no mislabel)
 *   - happy path → fragment includes preference + context buckets
 *   - cross-tenant numeric → THROWS PersonalKbBoundaryViolation
 *     (fail-loud propagates so the audit chain records a denial)
 *   - all-filtered (cross-tenant non-numeric below k-floor in
 *     non-allowed kinds) → throws too (below-k-floor is a violation
 *     per assertChineseWall)
 */

import { describe, it, expect } from 'vitest';
import {
  composePromptWithPersonLayer,
  PersonalKbBoundaryViolation,
} from '../index.js';
import type {
  PersonCellKind,
  PersonLayerDrizzleClient,
  PersonLayerSqlTemplate,
} from '../person-layer.js';

interface StubStatement {
  readonly fragments: ReadonlyArray<string>;
  readonly values: ReadonlyArray<unknown>;
}

const stubSql: PersonLayerSqlTemplate = (strings, ...values) =>
  ({
    fragments: [...strings],
    values: [...values],
  }) as StubStatement;

interface FakeCell {
  id: string;
  person_id: string;
  cell_kind: PersonCellKind;
  key: string;
  value: unknown;
  confidence: number;
  source_tenant_id: string | null;
  source_thread_id: string | null;
  captured_at: Date;
  expires_at: Date | null;
}

function createFakeDriver(seed: FakeCell[]): PersonLayerDrizzleClient {
  const cells = new Map<string, FakeCell>();
  for (const c of seed) cells.set(c.id, { ...c });
  return {
    async execute(query: unknown) {
      const stmt = query as StubStatement;
      const head = (stmt.fragments[0] ?? '').toLowerCase();
      if (head.includes('with bucketed')) {
        const personId = String(stmt.values[0]);
        const matched = [...cells.values()]
          .filter((c) => c.person_id === personId)
          .sort((a, b) => b.captured_at.getTime() - a.captured_at.getTime());
        return { rows: matched };
      }
      return { rows: [] };
    },
  };
}

describe('composePromptWithPersonLayer', () => {
  it('returns empty result when currentPersonId is empty', async () => {
    const db = createFakeDriver([]);
    const out = await composePromptWithPersonLayer({
      currentPersonId: '',
      currentTenantId: 'tenant-A-own-estate',
      db,
      sqlTemplate: stubSql,
    });
    expect(out.promptFragment).toBe('');
    expect(out.tags).toBeNull();
  });

  it('returns empty result when currentTenantId is empty (degraded)', async () => {
    const db = createFakeDriver([]);
    const out = await composePromptWithPersonLayer({
      currentPersonId: 'person-asha',
      currentTenantId: '',
      db,
      sqlTemplate: stubSql,
    });
    expect(out.promptFragment).toBe('');
    expect(out.tags).toBeNull();
  });

  it('renders [PERSONAL CONTEXT] block on happy path', async () => {
    const db = createFakeDriver([
      {
        id: 'c1',
        person_id: 'person-asha',
        cell_kind: 'preference',
        key: 'language',
        value: { lang: 'sw' },
        confidence: 1,
        source_tenant_id: null,
        source_thread_id: null,
        captured_at: new Date(),
        expires_at: null,
      },
      {
        id: 'c2',
        person_id: 'person-asha',
        cell_kind: 'context',
        key: 'flu',
        value: { recovering: true },
        confidence: 0.9,
        source_tenant_id: null,
        source_thread_id: null,
        captured_at: new Date(),
        expires_at: null,
      },
    ]);
    const out = await composePromptWithPersonLayer({
      currentPersonId: 'person-asha',
      currentTenantId: 'tenant-A-own-estate',
      db,
      sqlTemplate: stubSql,
    });
    expect(out.promptFragment).toContain('[PERSONAL CONTEXT');
    expect(out.promptFragment).toContain('Preferences:');
    expect(out.promptFragment).toContain('language');
    expect(out.promptFragment).toContain('Current context:');
    expect(out.tags?.crossTenantFlag).toBe(false);
  });

  it('THROWS PersonalKbBoundaryViolation on cross-tenant numeric leak (proof)', async () => {
    const db = createFakeDriver([
      {
        id: 'c1',
        person_id: 'person-asha',
        // recurring-fact + numeric payload + foreign tenant = LEAK.
        cell_kind: 'recurring-fact',
        key: 'rent-at-trust',
        value: { monthlyRent: 900000 },
        confidence: 1,
        source_tenant_id: 'tenant-B-family-trust',
        source_thread_id: null,
        captured_at: new Date(),
        expires_at: null,
      },
    ]);
    await expect(
      composePromptWithPersonLayer({
        currentPersonId: 'person-asha',
        currentTenantId: 'tenant-A-own-estate',
        db,
        sqlTemplate: stubSql,
      }),
    ).rejects.toBeInstanceOf(PersonalKbBoundaryViolation);
  });
});
