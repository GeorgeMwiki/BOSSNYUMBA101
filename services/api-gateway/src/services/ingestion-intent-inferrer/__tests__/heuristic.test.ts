/**
 * Brilliance contract regression tests for the deterministic heuristic.
 * Ported from Borjie heuristic.test.ts, retailored for real-estate.
 *
 * The heuristic MUST satisfy four invariants on every snapshot:
 *
 *   1. Every proposal carries at least one evidence_id (CLAUDE.md rule).
 *   2. Every proposal carries a non-empty bilingual reason (en + sw).
 *   3. The bilingual narrative renders in BOTH languages, always.
 *   4. Caps are respected (4 tabs / 3 reminders / 3 opportunities / 3 risks).
 *
 * These tests double as the brilliance-proof harness — if the heuristic
 * ever regresses to a hallucinated chunk id or an empty reason chain,
 * CI fails fast and the deploy is blocked.
 */

import { describe, expect, it } from 'vitest';

import { generateHeuristicIntent } from '../heuristic.js';
import type { IngestSnapshot } from '../types.js';

function snapshotFixture(overrides?: Partial<IngestSnapshot>): IngestSnapshot {
  const base: IngestSnapshot = {
    receipt: {
      uploadId: 'upload-123',
      status: 'indexed',
      chunksCount: 47,
      entitiesExtracted: 18,
      summary: null,
      warnings: [],
      previewEntities: [],
    },
    filename: 'tenants-q1.csv',
    sourceKind: 'csv',
    summaryEn: 'Q1 tenants across 3 unit types with TRA rental tax notes.',
    summarySw:
      'Wapangaji wa robo ya 1 kwa aina za nyumba 3 na maelezo ya kodi ya TRA.',
    keyFacts: [
      {
        kind: 'table.headers',
        value: 'tenant,unit,amount,tax,date',
        confidence: 1,
      },
      { kind: 'table.row_count', value: '50', confidence: 1 },
    ],
    availableEntities: [
      { kind: 'unit_type', id: 'apartment', displayName: 'Apartment' },
      { kind: 'unit_type', id: 'house', displayName: 'Nyumba (House)' },
      { kind: 'unit_type', id: 'studio', displayName: 'Studio / Bedsitter' },
      { kind: 'concept', id: 'lease', displayName: 'Lease (Kodi)' },
      { kind: 'concept', id: 'rent', displayName: 'Rent (Kodi)' },
      { kind: 'regulator', id: 'tra', displayName: 'TRA' },
      { kind: 'role', id: 'tenant', displayName: 'Tenant (Mpangaji)' },
      {
        kind: 'candidate_entity',
        id: 'asha_mwakikoti',
        displayName: 'Asha Mwakikoti',
      },
      {
        kind: 'candidate_entity',
        id: 'bahari_heights',
        displayName: 'Bahari Heights',
      },
      {
        kind: 'candidate_entity',
        id: 'green_valley',
        displayName: 'Green Valley',
      },
      {
        kind: 'candidate_entity',
        id: 'mwananchi_co',
        displayName: 'Mwananchi Co',
      },
      {
        kind: 'candidate_entity',
        id: 'kilimanjaro_homes',
        displayName: 'Kilimanjaro Homes',
      },
      { kind: 'money_mention', id: 'tzs_500k_0', displayName: 'TZS 500,000' },
      { kind: 'money_mention', id: 'tzs_800k_1', displayName: 'TZS 800,000' },
      { kind: 'money_mention', id: 'tzs_1m_2', displayName: 'TZS 1,000,000' },
      { kind: 'money_mention', id: 'tzs_1_2m_3', displayName: 'TZS 1,200,000' },
      { kind: 'date_mention', id: '2026_03_15_0', displayName: '2026-03-15' },
    ],
    chunkSamples: [
      {
        chunkId: 'chunk-a',
        excerpt: 'Tenant Asha paid TZS 800,000 rent on 2026-03-15.',
      },
      {
        chunkId: 'chunk-b',
        excerpt: 'Green Valley owes TZS 1,200,000 in rent — overdue.',
      },
      {
        chunkId: 'chunk-c',
        excerpt: 'TRA rental income tax filing for March is due in 7 days.',
      },
    ],
    detectedLanguage: 'en',
  };
  return { ...base, ...overrides };
}

describe('generateHeuristicIntent — brilliance contract', () => {
  it('produces a non-empty narrative in both languages', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    expect(intent.narrativeEn.length).toBeGreaterThan(0);
    expect(intent.narrativeSw.length).toBeGreaterThan(0);
    expect(intent.narrativeEn).not.toEqual(intent.narrativeSw);
  });

  it('every tab proposal carries at least one evidence id', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    for (const tab of intent.proposedTabs) {
      expect(tab.evidenceIds.length).toBeGreaterThan(0);
      expect(tab.reasonEn.length).toBeGreaterThan(0);
      expect(tab.reasonSw.length).toBeGreaterThan(0);
    }
  });

  it('every reminder proposal carries at least one evidence id', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    for (const reminder of intent.proposedReminders) {
      expect(reminder.evidenceIds.length).toBeGreaterThan(0);
      expect(reminder.reasonEn.length).toBeGreaterThan(0);
      expect(reminder.reasonSw.length).toBeGreaterThan(0);
      expect(Number.isFinite(Date.parse(reminder.triggerAtIso))).toBe(true);
    }
  });

  it('every opportunity carries at least one evidence id', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    for (const o of intent.proposedOpportunities) {
      expect(o.evidenceIds.length).toBeGreaterThan(0);
      expect(o.reasonEn.length).toBeGreaterThan(0);
      expect(o.reasonSw.length).toBeGreaterThan(0);
    }
  });

  it('every risk carries at least one evidence id', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    for (const r of intent.proposedRisks) {
      expect(r.evidenceIds.length).toBeGreaterThan(0);
      expect(r.reasonEn.length).toBeGreaterThan(0);
      expect(r.reasonSw.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(r.severity);
    }
  });

  it('caps at 4 tabs / 3 reminders / 3 opportunities / 3 risks', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    expect(intent.proposedTabs.length).toBeLessThanOrEqual(4);
    expect(intent.proposedReminders.length).toBeLessThanOrEqual(3);
    expect(intent.proposedOpportunities.length).toBeLessThanOrEqual(3);
    expect(intent.proposedRisks.length).toBeLessThanOrEqual(3);
  });

  it('falls back to upload-evidence id when chunk samples are empty', () => {
    const intent = generateHeuristicIntent(
      snapshotFixture({ chunkSamples: [] }),
    );
    // Every emitted proposal must still cite at least one evidence id.
    for (const tab of intent.proposedTabs) {
      expect(tab.evidenceIds.length).toBeGreaterThan(0);
      expect(tab.evidenceIds[0]).toMatch(/^upload:/);
    }
  });

  it('surfaces a tenants tab when the doc smells like a tenant list', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    const tenantsTab = intent.proposedTabs.find((t) => t.tabType === 'tenants');
    expect(tenantsTab).toBeDefined();
  });

  it('surfaces a compliance tab when regulator entities are present', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    const complianceTab = intent.proposedTabs.find(
      (t) => t.tabType === 'compliance',
    );
    expect(complianceTab).toBeDefined();
  });

  it('surfaces a portfolio tab when 2+ unit types are present', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    const portfolioTab = intent.proposedTabs.find(
      (t) => t.tabType === 'portfolio',
    );
    expect(portfolioTab).toBeDefined();
  });

  it('surfaces an expiring_lease risk when lease concept entities present', () => {
    const intent = generateHeuristicIntent(snapshotFixture());
    const leaseRisk = intent.proposedRisks.find(
      (r) => r.kind === 'expiring_lease',
    );
    expect(leaseRisk).toBeDefined();
  });

  it('produces stable proposal counts for the same snapshot', () => {
    const a = generateHeuristicIntent(snapshotFixture());
    const b = generateHeuristicIntent(snapshotFixture());
    expect(a.proposedTabs.length).toEqual(b.proposedTabs.length);
    expect(a.proposedReminders.length).toEqual(b.proposedReminders.length);
    expect(a.proposedOpportunities.length).toEqual(
      b.proposedOpportunities.length,
    );
    expect(a.proposedRisks.length).toEqual(b.proposedRisks.length);
  });

  it('produces a low-confidence empty plan when snapshot is trivial', () => {
    const intent = generateHeuristicIntent(
      snapshotFixture({
        availableEntities: [],
        keyFacts: [],
        filename: 'note.txt',
        summaryEn: null,
        summarySw: null,
      }),
    );
    expect(intent.confidence).toBeLessThanOrEqual(0.5);
    expect(intent.proposedTabs.length).toBeLessThanOrEqual(0);
    expect(intent.narrativeEn).toContain('note.txt');
  });
});
