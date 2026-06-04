import { describe, it, expect } from 'vitest';
import {
  wireDocumentReconciliation,
  DOCUMENT_RECONCILIATION_FLAG,
  type WireDocumentReconciliationDeps,
} from './wire';
import { createInMemoryReconciliationStore } from './in-memory-store';
import type { ReconciliationAuditSink, ReconciliationDataPort } from './ports';
import type { ExtractionForReconciliation } from './fact-bag-builder';

// ----------------------------------------------------------------------------
// fixtures
// ----------------------------------------------------------------------------

/** Two NIDA/lease extractions with conflicting national ids -> a STRICT block. */
const CONFLICTING: readonly ExtractionForReconciliation[] = [
  {
    documentId: 'doc-1',
    docType: 'nida',
    fields: [
      { field_name: 'full_name', value: 'Juma Kessy', confidence: 96 },
      { field_name: 'national_id_number', value: '19900510111122223333', confidence: 95 },
    ],
  },
  {
    documentId: 'doc-2',
    docType: 'lease-agreement',
    fields: [
      { field_name: 'full_name', value: 'Juma Kessy', confidence: 94 },
      { field_name: 'national_id_number', value: '19900510999988887777', confidence: 93 },
    ],
  },
];

function baseDeps(enabled: boolean): WireDocumentReconciliationDeps {
  return { enabled };
}

// ----------------------------------------------------------------------------
// (a) flag name
// ----------------------------------------------------------------------------

describe('feature-flag name', () => {
  it('is the canonical BOSSNYUMBA_FEATURE_* env name', () => {
    expect(DOCUMENT_RECONCILIATION_FLAG).toBe('BOSSNYUMBA_FEATURE_DOCUMENT_RECONCILIATION');
  });
});

// ----------------------------------------------------------------------------
// (b)(c) default OFF / bound when ON
// ----------------------------------------------------------------------------

describe('wireDocumentReconciliation — default OFF', () => {
  it('returns null when the flag is disabled', () => {
    expect(wireDocumentReconciliation(baseDeps(false))).toBeNull();
  });

  it('returns a bound facade when the flag is enabled', () => {
    const engine = wireDocumentReconciliation(baseDeps(true));
    expect(engine).not.toBeNull();
    expect(typeof engine?.handle).toBe('function');
    expect(typeof engine?.handleMatter).toBe('function');
  });
});

// ----------------------------------------------------------------------------
// (d) happy path
// ----------------------------------------------------------------------------

describe('wireDocumentReconciliation — bound handle', () => {
  it('reconciles an inline batch and blocks on a national-id mismatch', async () => {
    const engine = wireDocumentReconciliation(baseDeps(true));
    const report = await engine!.handle({ extractions: CONFLICTING });
    expect(report.blockers.some((b) => b.field === 'nationalId')).toBe(true);
    expect(report.overallConsistency).toBeLessThan(1);
  });

  it('persists the report and fires the audit sink when both are wired', async () => {
    const store = createInMemoryReconciliationStore();
    const entries: Array<{ matterId: string; blockerCount: number }> = [];
    const audit: ReconciliationAuditSink = {
      log: (e) => entries.push({ matterId: e.matterId, blockerCount: e.blockerCount }),
    };
    const engine = wireDocumentReconciliation({ enabled: true, store, audit });
    await engine!.handle({ extractions: CONFLICTING, tenantId: 'tenant-1', matterId: 'matter-1' });

    const stored = await store.get('matter-1');
    expect(stored?.tenantId).toBe('tenant-1');
    expect(stored?.report.blockers.length).toBeGreaterThan(0);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.matterId).toBe('matter-1');
    expect(entries[0]?.blockerCount).toBeGreaterThan(0);
  });
});

// ----------------------------------------------------------------------------
// (e) malformed input — zod boundary, no throw
// ----------------------------------------------------------------------------

describe('wireDocumentReconciliation — zod boundary', () => {
  it('returns a trivially-consistent empty report on a malformed request (no throw)', async () => {
    const engine = wireDocumentReconciliation(baseDeps(true));
    // `extractions` missing / wrong shape — must not throw.
    const report = await engine!.handle({ extractions: [{ documentId: 123 }] });
    expect(report.overallConsistency).toBe(1);
    expect(report.blockers).toHaveLength(0);
    expect(report.matches).toHaveLength(0);
  });

  it('returns an empty report for a completely non-object request', async () => {
    const engine = wireDocumentReconciliation(baseDeps(true));
    const report = await engine!.handle('not an object');
    expect(report.overallConsistency).toBe(1);
  });
});

// ----------------------------------------------------------------------------
// handleMatter — read-only data port, three outcomes stay safe
// ----------------------------------------------------------------------------

describe('wireDocumentReconciliation — handleMatter via data port', () => {
  const dataWith = (
    impl: ReconciliationDataPort['fetchExtractions'],
  ): ReconciliationDataPort => ({
    fetchExtractions: impl,
    fetchPriorReport: async () => null,
  });

  it('reconciles the fetched extractions for a matter (present value)', async () => {
    const engine = wireDocumentReconciliation({
      enabled: true,
      data: dataWith(async () => CONFLICTING),
    });
    const report = await engine!.handleMatter('matter-x', 'tenant-1');
    expect(report.blockers.some((b) => b.field === 'nationalId')).toBe(true);
  });

  it('returns an empty report when the matter has no documents (null)', async () => {
    const engine = wireDocumentReconciliation({
      enabled: true,
      data: dataWith(async () => null),
    });
    const report = await engine!.handleMatter('empty-matter');
    expect(report.overallConsistency).toBe(1);
    expect(report.blockers).toHaveLength(0);
  });

  it('is fail-soft when the fetcher throws (error outcome -> empty report)', async () => {
    const engine = wireDocumentReconciliation({
      enabled: true,
      data: dataWith(async () => {
        throw new Error('db down');
      }),
    });
    const report = await engine!.handleMatter('boom-matter');
    expect(report.overallConsistency).toBe(1);
  });

  it('returns an empty report when no data port is wired', async () => {
    const engine = wireDocumentReconciliation(baseDeps(true));
    const report = await engine!.handleMatter('no-data');
    expect(report.overallConsistency).toBe(1);
  });
});
