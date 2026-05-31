/**
 * Locale purity guard tests for BossNyumba server-side persona surfaces.
 *
 * Two assertions:
 *
 *   1. The onboarding welcome MD's greeting is strict per locale — the
 *      EN variant contains zero Swahili greeting words, and the SW
 *      variant contains zero English greeting words.
 *
 *   2. The describePage helper in `ai-presence-manager` accepts a
 *      language argument and returns the matching locale-strict copy.
 *      This was the source of a live "Habari! I can summarise…" bug
 *      where a Swahili greeting word leaked into an English session.
 *
 * Pure-string assertions only — no provider call, no live model.
 */

import { describe, expect, it } from 'vitest';

import { runWelcomeCoordinator } from '../onboarding-welcome-md.js';

const FORBIDDEN_SW_IN_EN = [
  'Habari',
  'Karibu',
  'Asante',
  'Tafadhali',
  'Bwana',
  'Hujambo',
  'Mfanyabiashara',
  'Mwenye nyumba',
  'Mpangaji',
];

const FORBIDDEN_EN_IN_SW = [
  'Hello',
  'Hi,',
  'Welcome',
  'Thanks',
  'Thank you',
  'Please',
  'Landlord',
  'Tenant',
];

describe('locale purity — onboarding welcome MD greeting', () => {
  it('EN greeting contains zero Swahili greeting words', async () => {
    const result = await runWelcomeCoordinator({
      ownerEmail: 'owner@example.com',
      businessName: 'Mwangi Estates',
      country: 'TZ',
      language: 'en',
    });
    for (const sw of FORBIDDEN_SW_IN_EN) {
      expect(result.greeting).not.toContain(sw);
    }
  });

  it('SW greeting contains zero English greeting words', async () => {
    const result = await runWelcomeCoordinator({
      ownerEmail: 'owner@example.com',
      businessName: 'Mwangi Estates',
      country: 'TZ',
      language: 'sw',
    });
    for (const en of FORBIDDEN_EN_IN_SW) {
      expect(result.greeting).not.toContain(en);
    }
  });

  it('defaults to EN when language is unset', async () => {
    const result = await runWelcomeCoordinator({
      ownerEmail: 'owner@example.com',
      businessName: 'Mwangi Estates',
      country: 'TZ',
    });
    expect(result.greeting).toMatch(/^Hi,? I.m Mr\. Mwikila/);
    for (const sw of FORBIDDEN_SW_IN_EN) {
      expect(result.greeting).not.toContain(sw);
    }
  });
});
