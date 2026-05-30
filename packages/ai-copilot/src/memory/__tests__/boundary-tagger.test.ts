/**
 * Tests for `boundary-tagger.ts` — Chinese-wall enforcement for the
 * federated PKB. Ported from Borjie with BN-named entities (landlord
 * Asha at tenant-A own-estate, tenant-B family-trust-estate, etc.).
 *
 * Coverage targets:
 *   - cross-tenant numeric cell BLOCKED
 *   - cross-tenant preference (no numeric) ALLOWED
 *   - same-tenant numeric ALLOWED (no wall crossed)
 *   - personal-layer (no source_tenant_id) ALWAYS ALLOWED
 *   - recurring-fact with numeric → BLOCKED
 *   - k=2 cross-tenant count → BELOW floor
 *   - k=3 cross-tenant count → SAFE to surface
 *   - crossTenantFlag tag set when allowed cells from non-active tenant
 *   - hiddenFromTenants includes every blocked source tenant
 *   - empty currentTenantId returns empty allowed list (refuses decision)
 *   - assertChineseWall THROWS PersonalKbBoundaryViolation on numeric leak
 *   - assertChineseWall returns verdict unchanged when no leak
 *   - PersonalKbBoundaryViolation.toLogPayload is redaction-safe
 */

import { describe, it, expect } from 'vitest';
import {
  enforceChineseWall,
  assertChineseWall,
  tagBoundary,
  cellContainsNumeric,
  K_ANONYMITY_FLOOR,
  PersonalKbBoundaryViolation,
  type EnforceChineseWallResult,
} from '../boundary-tagger.js';
import type {
  PersonalMemoryCell,
  PersonLayerResult,
  PersonCellKind,
} from '../person-layer.js';

// ────────────────────────────────────────────────────────────────────
// Fixture builders — BN-domain entities (landlord, tenants, currency).
// ────────────────────────────────────────────────────────────────────

let nextId = 0;

function makeCell(
  overrides: Partial<PersonalMemoryCell> & {
    cellKind: PersonCellKind;
    sourceTenantId?: string | null;
  },
): PersonalMemoryCell {
  nextId += 1;
  return Object.freeze({
    id: overrides.id ?? `cell-${nextId}`,
    personId: overrides.personId ?? 'person-asha',
    cellKind: overrides.cellKind,
    key: overrides.key ?? `key-${nextId}`,
    value: overrides.value ?? { ok: true },
    confidence: overrides.confidence ?? 1,
    sourceTenantId: overrides.sourceTenantId ?? null,
    sourceThreadId: overrides.sourceThreadId ?? null,
    capturedAt: overrides.capturedAt ?? new Date().toISOString(),
    expiresAt: overrides.expiresAt ?? null,
  });
}

function makeLayer(cells: PersonalMemoryCell[]): PersonLayerResult {
  const preferences = cells.filter((c) => c.cellKind === 'preference');
  const context = cells.filter(
    (c) => c.cellKind === 'context' || c.cellKind === 'sentiment',
  );
  const recurringFacts = cells.filter((c) => c.cellKind === 'recurring-fact');
  const calibration = cells.filter((c) => c.cellKind === 'calibration');
  return Object.freeze({
    preferences: Object.freeze(preferences),
    context: Object.freeze(context),
    recurringFacts: Object.freeze(recurringFacts),
    calibration: Object.freeze(calibration),
  });
}

// ────────────────────────────────────────────────────────────────────
// cellContainsNumeric — primitive predicate
// ────────────────────────────────────────────────────────────────────

describe('cellContainsNumeric', () => {
  it('detects raw numbers (rent amount)', () => {
    const cell = makeCell({
      cellKind: 'preference',
      value: { monthlyRent: 450000 },
    });
    expect(cellContainsNumeric(cell)).toBe(true);
  });

  it('detects numeric-shaped strings (TZS currency token)', () => {
    const cell = makeCell({
      cellKind: 'context',
      value: { rentText: '450,000 TZS' },
    });
    expect(cellContainsNumeric(cell)).toBe(true);
  });

  it('detects square-metre tokens (property area)', () => {
    const cell = makeCell({
      cellKind: 'recurring-fact',
      value: { unitSize: '85 sqm' },
    });
    expect(cellContainsNumeric(cell)).toBe(true);
  });

  it('returns false for boolean-only payloads', () => {
    const cell = makeCell({
      cellKind: 'preference',
      value: { wantsWhatsapp: true, polite: false },
    });
    expect(cellContainsNumeric(cell)).toBe(false);
  });

  it('returns false for string-only payloads with no digits', () => {
    const cell = makeCell({
      cellKind: 'preference',
      value: { greeting: 'habari', name: 'Asha' },
    });
    expect(cellContainsNumeric(cell)).toBe(false);
  });

  it('walks nested arrays + objects', () => {
    const cell = makeCell({
      cellKind: 'context',
      value: { nested: { deep: [{ deposit: '900,000 TZS' }] } },
    });
    expect(cellContainsNumeric(cell)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// enforceChineseWall — core verdict
// ────────────────────────────────────────────────────────────────────

describe('enforceChineseWall — cross-tenant numeric BLOCKED', () => {
  it('blocks a cross-tenant cell that contains a rent figure', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'preference',
        sourceTenantId: 'tenant-B-family-trust',
        value: { rentText: '450,000 TZS' },
      }),
    ]);
    const verdict = enforceChineseWall({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(verdict.allowedFacts.length).toBe(0);
    expect(verdict.blockedNumeric.length).toBe(1);
  });

  it('blocks a recurring-fact with numeric payload from another tenant', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { arrearsThreshold: 0.8 },
      }),
    ]);
    const verdict = enforceChineseWall({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(verdict.blockedNumeric.length).toBe(1);
    expect(verdict.allowedFacts.length).toBe(0);
  });
});

describe('enforceChineseWall — preferences ALWAYS allowed', () => {
  it('allows a cross-tenant preference with no numeric payload', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'preference',
        sourceTenantId: 'tenant-B-family-trust',
        value: { language: 'sw' },
      }),
    ]);
    const verdict = enforceChineseWall({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(verdict.allowedFacts.length).toBe(1);
    expect(verdict.blockedNumeric.length).toBe(0);
  });

  it('allows person-level cells (sourceTenantId === null)', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'preference',
        sourceTenantId: null,
        value: { language: 'sw' },
      }),
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: null,
        value: { mother: 'passed-aug-2024' },
      }),
    ]);
    const verdict = enforceChineseWall({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(verdict.allowedFacts.length).toBe(2);
    expect(verdict.blockedNumeric.length).toBe(0);
  });

  it('allows same-tenant numeric cells (no wall crossed)', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'preference',
        sourceTenantId: 'tenant-A-own-estate',
        value: { typicalRent: 450000 },
      }),
    ]);
    const verdict = enforceChineseWall({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(verdict.allowedFacts.length).toBe(1);
    expect(verdict.blockedNumeric.length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// k-anonymity (k ≥ 3)
// ────────────────────────────────────────────────────────────────────

describe('enforceChineseWall — k-anonymity floor', () => {
  it('marks k=2 cross-tenant cells as BELOW the k-floor', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { secret: 'numeric: 7' },
      }),
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { secret: 'numeric: 8' },
      }),
    ]);
    const verdict = enforceChineseWall({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(verdict.countsSafeToSurface.length).toBe(0);
    expect(verdict.countsBelowKFloor.length).toBe(1);
    expect(verdict.countsBelowKFloor[0]?.count).toBe(2);
  });

  it('marks k=3 cross-tenant counts as SAFE to surface', () => {
    expect(K_ANONYMITY_FLOOR).toBe(3);
    const layer = makeLayer([
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { secret: 'numeric: 1' },
      }),
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { secret: 'numeric: 2' },
      }),
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { secret: 'numeric: 3' },
      }),
    ]);
    const verdict = enforceChineseWall({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(verdict.countsSafeToSurface.length).toBe(1);
    expect(verdict.countsSafeToSurface[0]?.count).toBe(3);
    expect(verdict.countsBelowKFloor.length).toBe(0);
  });

  it('groups counts independently per (tenant, kind) bucket', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'preference',
        sourceTenantId: 'tenant-B-family-trust',
        value: { lang: 'sw' },
      }),
      makeCell({
        cellKind: 'preference',
        sourceTenantId: 'tenant-C-accountant-firm',
        value: { lang: 'en' },
      }),
      makeCell({
        cellKind: 'preference',
        sourceTenantId: 'tenant-C-accountant-firm',
        value: { lang: 'fr' },
      }),
    ]);
    const verdict = enforceChineseWall({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(verdict.crossTenantCounts.length).toBe(2);
    const tenantB = verdict.crossTenantCounts.find(
      (c) => c.sourceTenantId === 'tenant-B-family-trust',
    );
    const tenantC = verdict.crossTenantCounts.find(
      (c) => c.sourceTenantId === 'tenant-C-accountant-firm',
    );
    expect(tenantB?.count).toBe(1);
    expect(tenantC?.count).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────
// Refuse-to-decide path
// ────────────────────────────────────────────────────────────────────

describe('enforceChineseWall — empty currentTenantId', () => {
  it('treats every cell as blocked and returns empty allowed list', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'preference',
        sourceTenantId: null,
        value: { lang: 'sw' },
      }),
      makeCell({
        cellKind: 'context',
        sourceTenantId: 'tenant-B-family-trust',
        value: { unitsOwned: 5 },
      }),
    ]);
    const verdict: EnforceChineseWallResult = enforceChineseWall({
      personLayerData: layer,
      currentTenantId: '',
    });
    expect(verdict.allowedFacts.length).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// tagBoundary — composer-friendly shape
// ────────────────────────────────────────────────────────────────────

describe('tagBoundary', () => {
  it('sets crossTenantFlag when any allowed fact is from another tenant', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'preference',
        sourceTenantId: 'tenant-B-family-trust',
        value: { lang: 'sw' },
      }),
    ]);
    const tags = tagBoundary({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(tags.crossTenantFlag).toBe(true);
  });

  it('does NOT set crossTenantFlag when only same-tenant cells are allowed', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'preference',
        sourceTenantId: 'tenant-A-own-estate',
        value: { lang: 'sw' },
      }),
      makeCell({
        cellKind: 'preference',
        sourceTenantId: null,
        value: { lang: 'sw' },
      }),
    ]);
    const tags = tagBoundary({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(tags.crossTenantFlag).toBe(false);
  });

  it('includes every blocked source tenant in hiddenFromTenants (sorted)', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-C-accountant-firm',
        value: { unitsManaged: 4 },
      }),
      makeCell({
        cellKind: 'context',
        sourceTenantId: 'tenant-B-family-trust',
        value: { monthlyNet: 1000000 },
      }),
    ]);
    const tags = tagBoundary({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(tags.hiddenFromTenants).toEqual([
      'tenant-B-family-trust',
      'tenant-C-accountant-firm',
    ]);
  });

  it('exposes safe counts on the tag bag', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { units: 1 },
      }),
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { units: 2 },
      }),
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { units: 3 },
      }),
    ]);
    const tags = tagBoundary({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(tags.countsSafeToSurface.length).toBe(1);
    expect(tags.countsSafeToSurface[0]?.count).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// assertChineseWall — FAIL-LOUD on numeric leak
// ────────────────────────────────────────────────────────────────────

describe('assertChineseWall (fail-loud)', () => {
  it('THROWS PersonalKbBoundaryViolation on a cross-tenant numeric cell', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { monthlyRent: 450000 },
      }),
    ]);
    expect(() =>
      assertChineseWall({
        personLayerData: layer,
        currentTenantId: 'tenant-A-own-estate',
      }),
    ).toThrow(PersonalKbBoundaryViolation);
  });

  it('error carries blocked/hidden detail without leaking payload values', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { secretRent: '900,000 TZS', secretDeposit: 1800000 },
      }),
    ]);
    let caught: PersonalKbBoundaryViolation | null = null;
    try {
      assertChineseWall({
        personLayerData: layer,
        currentTenantId: 'tenant-A-own-estate',
      });
    } catch (e) {
      caught = e as PersonalKbBoundaryViolation;
    }
    expect(caught).toBeInstanceOf(PersonalKbBoundaryViolation);
    expect(caught?.currentTenantId).toBe('tenant-A-own-estate');
    expect(caught?.blockedNumericCount).toBe(1);
    expect(caught?.hiddenFromTenants).toEqual(['tenant-B-family-trust']);
    // The error message + log payload MUST NOT contain the leaked values.
    expect(caught?.message ?? '').not.toMatch(/900,000|1800000/);
    const payload = caught?.toLogPayload();
    expect(JSON.stringify(payload)).not.toMatch(/900,000|1800000/);
    expect(payload?.kind).toBe('personal-kb-boundary-violation');
  });

  it('THROWS on below-k-floor aggregate counts even without numeric payload', () => {
    // Two non-numeric recurring-facts from one foreign tenant — kind is
    // NOT in ALWAYS_ALLOWED, so they are blocked AND the aggregate
    // count (2) is below the k=3 floor.
    const layer = makeLayer([
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { note: 'lease-renewal-pending' },
      }),
      makeCell({
        cellKind: 'recurring-fact',
        sourceTenantId: 'tenant-B-family-trust',
        value: { note: 'maintenance-overdue' },
      }),
    ]);
    expect(() =>
      assertChineseWall({
        personLayerData: layer,
        currentTenantId: 'tenant-A-own-estate',
      }),
    ).toThrow(PersonalKbBoundaryViolation);
  });

  it('returns the verdict (no throw) when nothing crosses the wall', () => {
    const layer = makeLayer([
      makeCell({
        cellKind: 'preference',
        sourceTenantId: null,
        value: { language: 'sw' },
      }),
      makeCell({
        cellKind: 'preference',
        sourceTenantId: 'tenant-A-own-estate',
        value: { typicalRent: 450000 },
      }),
    ]);
    const verdict = assertChineseWall({
      personLayerData: layer,
      currentTenantId: 'tenant-A-own-estate',
    });
    expect(verdict.allowedFacts.length).toBe(2);
    expect(verdict.blockedNumeric.length).toBe(0);
  });
});
