/**
 * Unit tests for the claim extractor.
 */

import { describe, expect, it } from 'vitest';
import { extractClaims } from '../claim-extractor.js';

describe('extractClaims', () => {
  it('extracts a single amount claim', () => {
    const claims = extractClaims('Rent is KES 50,000.', 'amount');
    expect(claims.some((c) => c.text === 'KES 50,000')).toBe(true);
  });

  it('extracts ISO date claims', () => {
    const claims = extractClaims('Due 2026-05-14.', 'date');
    expect(claims.some((c) => c.text === '2026-05-14')).toBe(true);
  });

  it('extracts written date claims', () => {
    const claims = extractClaims('Due 14 May 2026.', 'date');
    expect(claims.some((c) => c.text === '14 May 2026')).toBe(true);
  });

  it('extracts statutory references', () => {
    const claims = extractClaims('See Land Act §41.', 'statutory-ref');
    expect(claims.length).toBeGreaterThanOrEqual(1);
    expect(claims.some((c) => /Land Act/.test(c.text))).toBe(true);
  });

  it('prunes overlapping address matches (longer wins)', () => {
    const claims = extractClaims('Plot 7 Unit 12B is leased.', 'address');
    expect(claims.some((c) => c.text === 'Plot 7 Unit 12B')).toBe(true);
    expect(claims.some((c) => c.text === 'Unit 12B')).toBe(false);
  });

  it('extracts party names with titles', () => {
    const claims = extractClaims('Contact Mr John Otieno today.', 'party-name');
    expect(claims.some((c) => c.text === 'Mr John Otieno')).toBe(true);
  });

  it('extracts case-insensitive tenant labels', () => {
    const claims = extractClaims('Tenant Asha Said pays on time.', 'party-name');
    expect(claims.some((c) => /Asha Said/.test(c.text))).toBe(true);
  });

  it('falls back to sentence-split for general class', () => {
    const claims = extractClaims(
      'Hello there. Rent is current as of 14 May 2026. We are happy.',
      'general',
    );
    expect(claims.length).toBeGreaterThanOrEqual(1);
    expect(claims.every((c) => c.factClass === 'general')).toBe(true);
  });

  it('returns empty array when no factual content', () => {
    const claims = extractClaims('Hello.', 'general');
    expect(claims).toHaveLength(0);
  });
});
