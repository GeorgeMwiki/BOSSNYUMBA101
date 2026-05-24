import { describe, expect, it } from 'vitest';
import { readAltaCommitment } from '../title/alta-commitment-reader.js';
import {
  recommendEndorsements,
} from '../insurance/title-endorsement-recommender.js';
import type { EndorsementContext } from '../insurance/title-endorsement-recommender.js';
import type { ScheduleBException } from '../types.js';

const emptyContext: EndorsementContext = {
  hasZoningCompletedStructure: false,
  hasZoningVacantLand: false,
  accessViaPrivateRoad: false,
  insuredIsContiguousParcels: false,
  hasSurveyAmendments: false,
  taxParcelMismatch: false,
  subdivisionApprovalNeeded: false,
  doingBusinessAs: false,
};

describe('recommendEndorsements', () => {
  it('recommends 9-06 + 9.2-06 when restrictive covenants present', () => {
    const exceptions: ScheduleBException[] = [
      { id: 'c1', type: 'restrictiveCovenant', description: 'HOA CC&R', impactScore: 5, curableAtClose: false },
    ];
    const reading = readAltaCommitment({ exceptions, standardExceptionsDeletable: true });
    const r = recommendEndorsements(reading, emptyContext);
    expect(r.some((x) => x.code === '9-06')).toBe(true);
    expect(r.some((x) => x.code === '9.2-06')).toBe(true);
  });

  it('recommends 22-06 + 35-06 when mineral reservation present', () => {
    const exceptions: ScheduleBException[] = [
      { id: 'm1', type: 'mineralReservation', description: 'Mineral rights reserved', impactScore: 8, curableAtClose: false },
    ];
    const reading = readAltaCommitment({ exceptions, standardExceptionsDeletable: true });
    const r = recommendEndorsements(reading, emptyContext);
    expect(r.some((x) => x.code === '22-06')).toBe(true);
    expect(r.some((x) => x.code === '35-06')).toBe(true);
  });

  it('recommends 17-06 when private-road access', () => {
    const reading = readAltaCommitment({ exceptions: [], standardExceptionsDeletable: true });
    const r = recommendEndorsements(reading, { ...emptyContext, accessViaPrivateRoad: true });
    expect(r.some((x) => x.code === '17-06')).toBe(true);
  });

  it('recommends 19-06 for contiguous parcels', () => {
    const reading = readAltaCommitment({ exceptions: [], standardExceptionsDeletable: true });
    const r = recommendEndorsements(reading, { ...emptyContext, insuredIsContiguousParcels: true });
    expect(r.some((x) => x.code === '19-06')).toBe(true);
  });

  it('recommends 3.1-06 for completed structure zoning', () => {
    const reading = readAltaCommitment({ exceptions: [], standardExceptionsDeletable: true });
    const r = recommendEndorsements(reading, { ...emptyContext, hasZoningCompletedStructure: true });
    expect(r.some((x) => x.code === '3.1-06')).toBe(true);
  });

  it('recommends 3-06 for vacant land', () => {
    const reading = readAltaCommitment({ exceptions: [], standardExceptionsDeletable: true });
    const r = recommendEndorsements(reading, { ...emptyContext, hasZoningVacantLand: true });
    expect(r.some((x) => x.code === '3-06')).toBe(true);
  });

  it('recommends 28.2-06 when boundary dispute present', () => {
    const exceptions: ScheduleBException[] = [
      { id: 'bd', type: 'boundaryDispute', description: 'Fence dispute with neighbor', impactScore: 8, curableAtClose: false },
    ];
    const reading = readAltaCommitment({ exceptions, standardExceptionsDeletable: true });
    const r = recommendEndorsements(reading, emptyContext);
    expect(r.some((x) => x.code === '28.2-06')).toBe(true);
  });

  it('no endorsements for clean commitment + empty context', () => {
    const reading = readAltaCommitment({ exceptions: [], standardExceptionsDeletable: true });
    const r = recommendEndorsements(reading, emptyContext);
    expect(r.length).toBe(0);
  });
});
