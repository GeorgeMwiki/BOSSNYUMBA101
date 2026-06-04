/**
 * PDPA readiness drills: subject access with third-party redaction, the
 * empty-subject flag, legal-hold-aware erasure, the end-to-end drill, and the
 * resolver-failure (generic error) path.
 */

import { describe, expect, it } from 'vitest';
import {
  createInMemoryPdpaSurface,
  fulfilErasure,
  fulfilSubjectAccess,
  pdpaEndToEnd,
  type PdpaDataPort,
  type SubjectArtefact,
  type SubjectArtefactResolver,
} from './index.js';

const NOW = '2026-06-03T12:00:00.000Z';

const artefacts: ReadonlyArray<SubjectArtefact> = [
  {
    subjectId: 'owner-1',
    kind: 'lease_application',
    id: 'a1',
    contents: 'Applicant owner-1, co-tenant Asha Komba listed.',
    thirdPartyPiiFields: ['Asha Komba'],
  },
  {
    subjectId: 'owner-1',
    kind: 'decision',
    id: 'a2',
    contents: 'Rent approved.',
    legalHoldUntilIso: '2027-01-01T00:00:00.000Z',
  },
  { subjectId: 'other', kind: 'document', id: 'a3', contents: 'unrelated' },
];

describe('PDPA readiness drills', () => {
  it('fulfils subject access and redacts third-party PII', async () => {
    const surface = createInMemoryPdpaSurface(artefacts);
    const res = await fulfilSubjectAccess(
      { subjectId: 'owner-1', receivedAt: NOW, scope: 'full' },
      surface,
      surface,
      NOW,
    );
    expect(res.passed).toBe(true);
    expect(res.artefactsCount).toBe(2);
    expect(res.redactedFields).toContain('Asha Komba');
  });

  it('flags a subject with no artefacts', async () => {
    const surface = createInMemoryPdpaSurface(artefacts);
    const res = await fulfilSubjectAccess(
      { subjectId: 'ghost', receivedAt: NOW, scope: 'full' },
      surface,
      surface,
      NOW,
    );
    expect(res.passed).toBe(false);
    expect(res.reason).toMatch(/no artefacts/);
  });

  it('honours legal hold on erasure', async () => {
    const surface = createInMemoryPdpaSurface(artefacts);
    const res = await fulfilErasure(
      { subjectId: 'owner-1', receivedAt: NOW },
      surface,
      surface,
      NOW,
    );
    expect(res.passed).toBe(true);
    expect(res.artefactsCount).toBe(1); // a1 erased
    expect(res.residualOnLegalHold).toContain('a2'); // held until 2027
    expect(surface.snapshot().some((a) => a.id === 'a1')).toBe(false);
    expect(surface.snapshot().some((a) => a.id === 'a2')).toBe(true);
  });

  it('runs the end-to-end access+erasure drill', async () => {
    const surface = createInMemoryPdpaSurface(artefacts);
    const { access, erasure } = await pdpaEndToEnd('owner-1', surface, surface, NOW);
    expect(access.passed).toBe(true);
    expect(erasure.passed).toBe(true);
  });

  it('treats a throwing resolver as a generic error, not a crash', async () => {
    const throwingResolver: SubjectArtefactResolver = {
      fetchArtefacts: async () => {
        throw new Error('store unavailable');
      },
    };
    const noopData: PdpaDataPort = {
      redact: (a) => a,
      erase: async () => undefined,
    };
    const res = await fulfilSubjectAccess(
      { subjectId: 'owner-1', receivedAt: NOW, scope: 'full' },
      throwingResolver,
      noopData,
      NOW,
    );
    expect(res.passed).toBe(false);
    expect(res.reason).toMatch(/resolver failed/);
  });
});
