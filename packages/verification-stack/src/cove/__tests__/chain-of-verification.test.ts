/**
 * CoVe regression tests — 15 fixtures: 10 successful-verify + 5
 * catch-hallucinations.
 *
 * Each fixture wires a deterministic evidence answerer so the test is
 * stable: the answerer returns a pre-canned `{answer, confidence}`
 * for each (claim, question) pair, mirroring what the property-data
 * tools would emit.
 */

import { describe, expect, it } from 'vitest';
import { chainOfVerification } from '../chain-of-verification.js';
import {
  evidenceAnswerer,
  type AnswererPort,
  type IndependentAnswer,
} from '../independent-answerer.js';
import { fixedClock } from '../../ports/clock.js';
import type { FactClass, FactualClaim } from '../../types.js';

interface Fixture {
  readonly name: string;
  readonly draft: string;
  readonly factClass: FactClass;
  readonly truth: ReadonlyArray<{
    readonly textMatcher: string; // substring of claim.text we expect to find
    readonly verified: boolean;
    readonly answer: string;
    readonly confidence: number;
  }>;
  readonly expectVerdict: 'pass' | 'flag';
  readonly expectUnverifiedCount: number;
}

const fixtures: ReadonlyArray<Fixture> = [
  // ─── 10 successful verify ────────────────────────────────────────
  {
    name: 'amount correctly verified — rent KES 50,000',
    draft: 'Your monthly rent is KES 50,000 due on 1 May 2026.',
    factClass: 'amount',
    truth: [
      {
        textMatcher: 'KES 50,000',
        verified: true,
        answer: 'Rent ledger confirms KES 50,000 outstanding.',
        confidence: 0.95,
      },
      {
        textMatcher: '1 May 2026',
        verified: true,
        answer: 'Lease says 1 May 2026 due date.',
        confidence: 0.9,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },
  {
    name: 'date correctly verified — single date claim',
    draft: 'The lease commenced on 2024-01-15.',
    factClass: 'date',
    truth: [
      {
        textMatcher: '2024-01-15',
        verified: true,
        answer: 'Lease repository confirms commencement date 2024-01-15.',
        confidence: 0.92,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },
  {
    name: 'party-name correctly verified',
    draft: 'Mr John Otieno occupies Unit 3A.',
    factClass: 'party-name',
    truth: [
      {
        textMatcher: 'Mr John Otieno',
        verified: true,
        answer: 'Tenant registry: Mr John Otieno occupies Unit 3A.',
        confidence: 0.9,
      },
      {
        textMatcher: 'Unit 3A',
        verified: true,
        answer: 'Property registry confirms Unit 3A is leased.',
        confidence: 0.88,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },
  {
    name: 'address correctly verified',
    draft: 'Plot 7 Unit 12B is currently leased.',
    factClass: 'address',
    truth: [
      {
        textMatcher: 'Plot 7 Unit 12B',
        verified: true,
        answer: 'Property registry: Plot 7 Unit 12B is leased.',
        confidence: 0.9,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },
  {
    name: 'statutory-ref correctly verified',
    draft: 'Per the Rent Restriction Act, 14-day notice applies.',
    factClass: 'statutory-ref',
    truth: [
      {
        textMatcher: 'Rent Restriction Act',
        verified: true,
        answer: 'Statute database: Rent Restriction Act applies in TZ-DSM.',
        confidence: 0.92,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },
  {
    name: 'general fact-class — sentence-split verification',
    draft: 'Tenant Mary has been compliant. Her rent is current as of 14 May 2026.',
    factClass: 'general',
    truth: [
      {
        textMatcher: 'Tenant Mary',
        verified: true,
        answer: 'Tenant Mary is on the active roster.',
        confidence: 0.85,
      },
      {
        textMatcher: '14 May 2026',
        verified: true,
        answer: 'Last payment was confirmed 14 May 2026.',
        confidence: 0.88,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },
  {
    name: 'amount + date both verify',
    draft: 'Outstanding rent is TZS 120,000 since 1 March 2026.',
    factClass: 'amount',
    truth: [
      {
        textMatcher: 'TZS 120,000',
        verified: true,
        answer: 'Ledger: TZS 120,000 outstanding.',
        confidence: 0.93,
      },
      {
        textMatcher: '1 March 2026',
        verified: true,
        answer: 'Last payment was 28 February 2026; arrears began 1 March 2026.',
        confidence: 0.9,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },
  {
    name: 'multiple amounts — all verify',
    draft: 'You owe KES 30,000 in rent plus KES 5,000 in late fees.',
    factClass: 'amount',
    truth: [
      {
        textMatcher: 'KES 30,000',
        verified: true,
        answer: 'Ledger: rent KES 30,000.',
        confidence: 0.91,
      },
      {
        textMatcher: 'KES 5,000',
        verified: true,
        answer: 'Ledger: late fee KES 5,000.',
        confidence: 0.89,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },
  {
    name: 'date — ISO format verifies',
    draft: 'Eviction hearing is set for 2026-06-30.',
    factClass: 'date',
    truth: [
      {
        textMatcher: '2026-06-30',
        verified: true,
        answer: 'Court calendar: hearing scheduled 2026-06-30.',
        confidence: 0.96,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },
  {
    name: 'mixed claims — all verify',
    draft: 'Tenant Asha Said at Plot 12 Unit 5A owes TZS 80,000 as of 1 April 2026.',
    factClass: 'amount',
    truth: [
      {
        textMatcher: 'TZS 80,000',
        verified: true,
        answer: 'Ledger: TZS 80,000.',
        confidence: 0.9,
      },
      {
        textMatcher: '1 April 2026',
        verified: true,
        answer: 'Arrears began 1 April 2026.',
        confidence: 0.88,
      },
      {
        textMatcher: 'tenant Asha Said',
        verified: true,
        answer: 'Tenant Asha Said is on the roster.',
        confidence: 0.87,
      },
      {
        textMatcher: 'Plot 12 Unit 5A',
        verified: true,
        answer: 'Plot 12 Unit 5A is the leased unit.',
        confidence: 0.86,
      },
    ],
    expectVerdict: 'pass',
    expectUnverifiedCount: 0,
  },

  // ─── 5 catch-hallucinations ─────────────────────────────────────
  {
    name: 'HALLUCINATION — fabricated amount',
    draft: 'You owe KES 999,999,999 — pay immediately.',
    factClass: 'amount',
    truth: [
      {
        textMatcher: 'KES 999,999,999',
        verified: false,
        answer: 'No ledger entry matches that amount.',
        confidence: 0.95, // confidence is high BUT answer rejects literal-match
      },
    ],
    expectVerdict: 'flag',
    expectUnverifiedCount: 1,
  },
  {
    name: 'HALLUCINATION — fabricated date',
    draft: 'Your lease started on 2099-12-31.',
    factClass: 'date',
    truth: [
      {
        textMatcher: '2099-12-31',
        verified: false,
        answer: 'Lease repository has no record of that start date.',
        confidence: 0.95,
      },
    ],
    expectVerdict: 'flag',
    expectUnverifiedCount: 1,
  },
  {
    name: 'HALLUCINATION — fabricated tenant name',
    draft: 'Mr Imaginary Person is the leaseholder.',
    factClass: 'party-name',
    truth: [
      {
        textMatcher: 'Mr Imaginary Person',
        verified: false,
        answer: 'Tenant registry has no Mr Imaginary Person.',
        confidence: 0.93,
      },
    ],
    expectVerdict: 'flag',
    expectUnverifiedCount: 1,
  },
  {
    name: 'HALLUCINATION — fabricated statute',
    draft: 'Under the Made-Up Eviction Act 2030, no notice is required.',
    factClass: 'statutory-ref',
    truth: [
      {
        textMatcher: 'Made-Up Eviction Act',
        verified: false,
        answer: 'Statute database has no Made-Up Eviction Act.',
        confidence: 0.9,
      },
    ],
    expectVerdict: 'flag',
    expectUnverifiedCount: 1,
  },
  {
    name: 'HALLUCINATION — answerer returns no-data (low confidence)',
    draft: 'Tenant Phantom Holder at Plot 999 Unit 99Z owes KES 100,000.',
    factClass: 'amount',
    truth: [
      {
        textMatcher: 'KES 100,000',
        verified: false,
        answer: 'no-data',
        confidence: 0,
      },
      {
        textMatcher: 'tenant Phantom Holder',
        verified: false,
        answer: 'no-data',
        confidence: 0,
      },
      {
        textMatcher: 'Plot 999 Unit 99Z',
        verified: false,
        answer: 'no-data',
        confidence: 0,
      },
    ],
    expectVerdict: 'flag',
    expectUnverifiedCount: 3,
  },
];

function buildAnswerer(fixture: Fixture): AnswererPort {
  return evidenceAnswerer({
    lookup: (claim: FactualClaim) => {
      const truth = fixture.truth.find((t) =>
        claim.text.toLowerCase().includes(t.textMatcher.toLowerCase()),
      );
      if (!truth) return null;
      return { answer: truth.answer, confidence: truth.confidence };
    },
  });
}

describe('chainOfVerification — 15 regression fixtures', () => {
  for (const fixture of fixtures) {
    it(fixture.name, async () => {
      const answerer = buildAnswerer(fixture);
      const result = await chainOfVerification(fixture.draft, fixture.factClass, {
        answerer,
        clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
      });
      expect(result.verdict).toBe(fixture.expectVerdict);
      expect(result.unverifiedClaims.length).toBe(fixture.expectUnverifiedCount);
      expect(result.originalDraft).toBe(fixture.draft);
      // Pass-verdict drafts should not have NEEDS_VERIFY annotations.
      if (fixture.expectVerdict === 'pass') {
        expect(result.revisedDraft).not.toContain('[NEEDS_VERIFY]');
      } else {
        expect(result.revisedDraft).toContain('[NEEDS_VERIFY]');
      }
    });
  }
});

describe('chainOfVerification — edge behaviour', () => {
  it('returns pass when no claims found', async () => {
    const answerer: AnswererPort = {
      async answer(_c, q): Promise<IndependentAnswer> {
        return { question: q, answer: 'irrelevant', confidence: 0.9, source: 'evidence' };
      },
    };
    const result = await chainOfVerification('Hello there.', 'amount', {
      answerer,
    });
    expect(result.verdict).toBe('pass');
    expect(result.claims).toHaveLength(0);
    expect(result.unverifiedClaims).toHaveLength(0);
  });

  it('handles answerer returning no-data on all questions', async () => {
    const answerer: AnswererPort = {
      async answer(_c, q): Promise<IndependentAnswer> {
        return { question: q, answer: 'no-data', confidence: 0, source: 'no-data' };
      },
    };
    const result = await chainOfVerification(
      'Rent is TZS 50,000.',
      'amount',
      { answerer },
    );
    expect(result.verdict).toBe('flag');
    expect(result.revisedDraft).toContain('[NEEDS_VERIFY]');
  });
});
