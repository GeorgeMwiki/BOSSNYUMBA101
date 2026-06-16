/**
 * Absolute sw/en toggle guard for the audience marketing pages.
 *
 * This is the CI backstop for the language-engineering canon: every audience
 * in the English `COPY` map MUST have a complete Swahili entry in `COPY_SW`,
 * so a visitor on the `sw` locale NEVER sees English audience copy (no
 * cross-language fallback) — and the English copy never carries a Swahili
 * fragment (no reverse mixing). The bug this prevents: 16 audience pages
 * silently rendering English under `sw` because `COPY_SW` only covered one
 * audience, plus an English `tenant.ctaHeading` that held a Swahili string.
 */
import { describe, it, expect } from 'vitest';

import { COPY, COPY_SW } from '../audience-copy';

type AudienceKey = keyof typeof COPY;

const EN_KEYS = Object.keys(COPY) as AudienceKey[];

/** Collect every leaf string of an AudiencePageCopy (recursively). */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

const FIELDS = [
  'heroKicker',
  'heroHeadline',
  'heroHeadlineAccent',
  'heroSub',
  'heroPrimaryCta',
  'heroSecondaryCta',
  'trustline',
  'statsHeading',
  'statsSub',
  'stats',
  'stepsKicker',
  'stepsHeading',
  'steps',
  'problemKicker',
  'problemHeading',
  'problemHeadingAccent',
  'problemSub',
  'problemTitle',
  'problems',
  'solutionTitle',
  'solutions',
  'ctaHeading',
  'ctaSub',
  'ctaPrimary',
] as const;

describe('audience-copy sw/en parity (absolute toggle)', () => {
  it('COPY_SW covers every audience in COPY (no missing Swahili page)', () => {
    expect(Object.keys(COPY_SW).sort()).toEqual([...EN_KEYS].sort());
  });

  it.each(EN_KEYS)('the %s Swahili entry is structurally complete', (key) => {
    const en = COPY[key];
    const sw = COPY_SW[key];
    expect(sw, `COPY_SW.${key} is missing`).toBeDefined();
    if (!sw) return;
    for (const field of FIELDS) {
      expect(sw, `COPY_SW.${key}.${field} missing`).toHaveProperty(field);
    }
    // Same number of trustline items / stats / steps / problems / solutions.
    expect(sw.trustline).toHaveLength(en.trustline.length);
    expect(sw.stats).toHaveLength(en.stats.length);
    expect(sw.steps).toHaveLength(en.steps.length);
    expect(sw.problems).toHaveLength(en.problems.length);
    expect(sw.solutions).toHaveLength(en.solutions.length);
    // No empty strings anywhere.
    for (const s of strings(sw))
      expect(s.trim().length, `empty string in COPY_SW.${key}`).toBeGreaterThan(0);
  });

  it('no English audience copy contains the Swahili honorific "Mwl. Mwikila"', () => {
    // English must say "Mr. Mwikila"; finding "Mwl." in EN means a Swahili
    // fragment leaked into the English copy (reverse mixing).
    for (const key of EN_KEYS) {
      for (const s of strings(COPY[key])) {
        expect(s, `English COPY.${key} leaks Swahili honorific: ${s}`).not.toContain('Mwl.');
      }
    }
  });

  it('no Swahili audience copy contains the English honorific "Mr. Mwikila"', () => {
    // Swahili must say "Mwl. Mwikila"; finding "Mr. Mwikila" in SW means an
    // English fragment leaked into the Swahili copy (mixing).
    for (const key of EN_KEYS) {
      const sw = COPY_SW[key];
      if (!sw) continue;
      for (const s of strings(sw)) {
        expect(s, `Swahili COPY_SW.${key} leaks English honorific: ${s}`).not.toContain(
          'Mr. Mwikila'
        );
      }
    }
  });
});
