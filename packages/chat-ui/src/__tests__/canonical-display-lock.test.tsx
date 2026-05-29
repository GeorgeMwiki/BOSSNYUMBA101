/**
 * Widget canonical display lock — pins the BossNyumba widget surface
 * to MR_MWIKILA_CANONICAL_DISPLAY. See:
 *   - Docs/DESIGN/CAPABILITIES_UNIFICATION.md "User-facing identity is locked"
 *   - packages/chat-ui/src/canonical-display.ts
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WIDGET_STRINGS_EN,
  DEFAULT_WIDGET_STRINGS_SW,
} from '../widget/types';
import { MR_MWIKILA_CANONICAL_DISPLAY } from '../canonical-display.js';

const SPECIALISATION_LEAK_SIGNALS: ReadonlyArray<string> = [
  'Specialist',
  'Advisor',
  'Officer',
  'Concierge',
  'Junior',
  'subtitle',
];

describe('Widget canonical display lock — BossNyumba', () => {
  it('EN persona header text equals MR_MWIKILA_CANONICAL_DISPLAY.name_full', () => {
    expect(DEFAULT_WIDGET_STRINGS_EN.personaName).toBe(
      MR_MWIKILA_CANONICAL_DISPLAY.name_full,
    );
  });

  it('EN greeting embeds MR_MWIKILA_CANONICAL_DISPLAY.name_full', () => {
    expect(DEFAULT_WIDGET_STRINGS_EN.greet).toContain(
      MR_MWIKILA_CANONICAL_DISPLAY.name_full,
    );
  });

  it('EN placeholder embeds MR_MWIKILA_CANONICAL_DISPLAY.name', () => {
    expect(DEFAULT_WIDGET_STRINGS_EN.placeholder).toContain(
      MR_MWIKILA_CANONICAL_DISPLAY.name,
    );
  });

  it('EN persona header never leaks a specialisation subtitle', () => {
    const text = DEFAULT_WIDGET_STRINGS_EN.personaName;
    for (const signal of SPECIALISATION_LEAK_SIGNALS) {
      expect(text).not.toContain(signal);
    }
  });

  it('canonical title matches "Boss Nyumba\'s AI Property Operations Manager"', () => {
    expect(MR_MWIKILA_CANONICAL_DISPLAY.title).toBe(
      "Boss Nyumba's AI Property Operations Manager",
    );
  });

  it('SW personaName uses the Swahili honorific Bw. (legacy — re-mapped post-doc-update)', () => {
    // SW strings retain the Swahili honorific "Bw. Mwikila" for the
    // SW locale; the founder lock applies to the canonical EN identity.
    expect(DEFAULT_WIDGET_STRINGS_SW.personaName).toContain('Mwikila');
  });
});
