/**
 * Question generator unit tests.
 */

import { describe, expect, it } from 'vitest';
import { generateVerificationQuestions } from '../question-generator.js';
import type { FactualClaim } from '../../types.js';

const baseClaim: Omit<FactualClaim, 'factClass' | 'text'> = { id: 'c_1' };

describe('generateVerificationQuestions', () => {
  it('emits ≥ 3 questions per claim', () => {
    const classes: ReadonlyArray<FactualClaim['factClass']> = [
      'amount',
      'date',
      'party-name',
      'address',
      'statutory-ref',
      'general',
    ];
    for (const factClass of classes) {
      const claim: FactualClaim = {
        ...baseClaim,
        factClass,
        text: 'sample',
      };
      const questions = generateVerificationQuestions(claim);
      expect(questions.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('emits ≤ 5 questions per claim', () => {
    const claim: FactualClaim = {
      ...baseClaim,
      factClass: 'amount',
      text: 'KES 100',
    };
    expect(generateVerificationQuestions(claim).length).toBeLessThanOrEqual(5);
  });

  it('amount-class questions reference rent ledger + tenant currency', () => {
    const qs = generateVerificationQuestions({
      ...baseClaim,
      factClass: 'amount',
      text: 'KES 100',
    });
    expect(qs.join(' ')).toMatch(/ledger/i);
    expect(qs.join(' ')).toMatch(/currenc/i);
  });

  it('date-class questions reference jurisdiction calendar', () => {
    const qs = generateVerificationQuestions({
      ...baseClaim,
      factClass: 'date',
      text: '1 May 2026',
    });
    expect(qs.join(' ')).toMatch(/jurisdiction/i);
  });

  it('statutory-ref questions check current statute', () => {
    const qs = generateVerificationQuestions({
      ...baseClaim,
      factClass: 'statutory-ref',
      text: 'Land Act §41',
    });
    expect(qs.join(' ')).toMatch(/statute|jurisdiction/i);
  });
});
