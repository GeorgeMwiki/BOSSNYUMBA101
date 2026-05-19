/**
 * Heuristic Constitutional Critic unit tests.
 */

import { describe, expect, it } from 'vitest';
import { heuristicConstitutionalCritic } from '../heuristic-critic.js';

const critic = heuristicConstitutionalCritic();

describe('heuristicConstitutionalCritic', () => {
  it('flags 14-day-notice violation', async () => {
    const v = await critic.score({
      actionId: 'a',
      actionClass: 'eviction',
      tenantId: null,
      draft: 'You will be evicted immediately, no notice required.',
    });
    expect(v.passed).toBe(false);
    expect(
      v.scores.find((s) => s.ruleId === 'tz-rental-act-notice-period')!.score,
    ).toBeLessThan(0.7);
  });

  it('passes compliant 14-day notice', async () => {
    const v = await critic.score({
      actionId: 'a',
      actionClass: 'eviction-warning',
      tenantId: null,
      draft: 'Statutory 14-day notice has been served.',
    });
    expect(v.passed).toBe(true);
  });

  it('flags deposit forfeiture', async () => {
    const v = await critic.score({
      actionId: 'a',
      actionClass: 'lease-termination',
      tenantId: null,
      draft: 'Deposit forfeited.',
    });
    const depositScore = v.scores.find(
      (s) => s.ruleId === 'tz-rental-act-deposit-handling',
    );
    expect(depositScore?.score).toBeLessThan(0.7);
  });

  it('flags > 6 months advance rent', async () => {
    const v = await critic.score({
      actionId: 'a',
      actionClass: 'lease-renewal-offer',
      tenantId: null,
      draft: 'Pay 12 months rent in advance.',
    });
    const advance = v.scores.find((s) => s.ruleId === 'tz-rental-act-advance-rent');
    expect(advance?.score).toBeLessThan(0.7);
  });

  it('flags PII boundary violation', async () => {
    const v = await critic.score({
      actionId: 'a',
      actionClass: 'other',
      tenantId: null,
      draft: 'We will share phone numbers with another tenant.',
    });
    const pii = v.scores.find((s) => s.ruleId === 'gdpr-pii-boundary');
    expect(pii?.score).toBeLessThan(0.7);
  });

  it('flags raw API keys', async () => {
    const v = await critic.score({
      actionId: 'a',
      actionClass: 'other',
      tenantId: null,
      draft: 'Use api-key: sk-abcdefghij12345 in production.',
    });
    const secret = v.scores.find((s) => s.ruleId === 'inviolable-ip-secret-redaction');
    expect(secret?.score).toBeLessThan(0.7);
  });

  it('scores 8 rules per call', async () => {
    const v = await critic.score({
      actionId: 'a',
      actionClass: 'rent-reminder',
      tenantId: null,
      draft: 'Hello.',
    });
    expect(v.scores).toHaveLength(8);
  });
});
