/**
 * Tests for Module 9 — Monthly Red-Team Rotation.
 */
import { describe, it, expect } from 'vitest';
import {
  validateMonthlyBatch,
  auditRotationLedger,
  buildLedgerEntries,
  DEFAULT_REQUIREMENT,
} from '../monthly-red-team-rotation/index.js';
import type { RedTeamScenarioDraft } from '../monthly-red-team-rotation/index.js';

function draft(author: string, input: string): RedTeamScenarioDraft {
  return {
    category: 'jailbreak-resistance', severity: 'high', input,
    expected_action: 'refuse', forbidden_actions: ['comply'], tags: [],
    author_id: author,
  };
}

describe('monthly red-team rotation', () => {
  it('accepts a healthy batch of 10 from 3 authors', () => {
    const batch: RedTeamScenarioDraft[] = [
      draft('alice', 'i1'), draft('alice', 'i2'), draft('alice', 'i3'),
      draft('bob', 'i4'), draft('bob', 'i5'), draft('bob', 'i6'),
      draft('carol', 'i7'), draft('carol', 'i8'), draft('carol', 'i9'),
      draft('alice', 'i10'),
    ];
    expect(validateMonthlyBatch(batch)).toHaveLength(0);
  });

  it('rejects fewer than target_per_month drafts', () => {
    const p = validateMonthlyBatch([draft('a', 'i1')]);
    expect(p[0]).toMatch(/only 1 drafts/);
  });

  it('rejects single-author batches', () => {
    const batch = Array.from({ length: 10 }, (_, i) => draft('alice', `i${i}`));
    const p = validateMonthlyBatch(batch);
    expect(p.some(x => /unique authors/.test(x))).toBe(true);
  });

  it('rejects duplicate inputs', () => {
    const batch: RedTeamScenarioDraft[] = [
      draft('a', 'same'), draft('b', 'same'),
      draft('c', 'x1'), draft('a', 'x2'), draft('b', 'x3'),
      draft('c', 'x4'), draft('a', 'x5'), draft('b', 'x6'),
      draft('c', 'x7'), draft('a', 'x8'),
    ];
    const p = validateMonthlyBatch(batch);
    expect(p.some(x => /duplicate input/.test(x))).toBe(true);
  });

  it('rejects empty input', () => {
    const batch: RedTeamScenarioDraft[] = Array.from({ length: 10 }, (_, i) =>
      i === 0 ? draft('a', '   ') : draft(`auth-${i % 3}`, `i${i}`),
    );
    const p = validateMonthlyBatch(batch);
    expect(p.some(x => /empty input/.test(x))).toBe(true);
  });

  it('rejects scenarios with no forbidden_actions', () => {
    const batch: RedTeamScenarioDraft[] = Array.from({ length: 10 }, (_, i) => ({
      category: 'c', severity: 'high', input: `i${i}`,
      expected_action: 'refuse',
      forbidden_actions: i === 0 ? [] : ['x'],
      tags: [], author_id: `a${i % 3}`,
    }));
    const p = validateMonthlyBatch(batch);
    expect(p.some(x => /no forbidden_actions/.test(x))).toBe(true);
  });

  it('flags author concentration in audit', () => {
    const ledger = {
      version: '1',
      entries: Array.from({ length: 30 }, (_, i) => ({
        scenario_id: `s${i}`, author_id: i < 25 ? 'alice' : 'bob',
        added_at: new Date().toISOString(), manifest_hash_after: 'h',
      })),
    };
    const r = auditRotationLedger(ledger);
    expect(r.diverse_enough).toBe(false);
    expect(r.max_share_by_author).toBeGreaterThan(0.4);
  });

  it('passes audit on diverse ledger', () => {
    const ledger = {
      version: '1',
      entries: Array.from({ length: 30 }, (_, i) => ({
        scenario_id: `s${i}`, author_id: `a${i % 5}`,
        added_at: new Date().toISOString(), manifest_hash_after: 'h',
      })),
    };
    const r = auditRotationLedger(ledger);
    expect(r.diverse_enough).toBe(true);
  });

  it('audit window excludes old entries', () => {
    const ledger = {
      version: '1', entries: [
        { scenario_id: 'old', author_id: 'a', added_at: '2020-01-01T00:00:00Z', manifest_hash_after: 'h' },
      ],
    };
    const r = auditRotationLedger(ledger);
    expect(r.total_scenarios_added).toBe(0);
  });

  it('buildLedgerEntries stamps prefix + manifest hash', () => {
    const drafts = [draft('a', 'i1'), draft('b', 'i2')];
    const entries = buildLedgerEntries(drafts, '2026-06', 'manifestX');
    expect(entries[0]?.scenario_id).toBe('2026-06-001');
    expect(entries[1]?.scenario_id).toBe('2026-06-002');
    expect(entries[0]?.manifest_hash_after).toBe('manifestX');
  });

  it('DEFAULT_REQUIREMENT exposes target 10', () => {
    expect(DEFAULT_REQUIREMENT.target_per_month).toBe(10);
    expect(DEFAULT_REQUIREMENT.min_unique_authors_per_month).toBe(3);
    expect(DEFAULT_REQUIREMENT.max_author_share_threshold).toBe(0.4);
  });
});
