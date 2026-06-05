/**
 * Estate-mode overlay adapter tests.
 *
 * Locks in the contract that makes the PRIMARY /api/v1/brain/turn route
 * estate-mode-aware:
 *   - one test per estate mode (build / operations / finance / growth /
 *     compliance): the overlaid persona's systemPrompt reflects that mode and
 *     its tools are the INTERSECTION of the base persona's tools and the mode
 *     allow-list (never widened);
 *   - a non-estate persona passes through UNCHANGED (same object reference);
 *   - EN vs SW locale envelopes are single-language and mutually exclusive;
 *   - the base orchestrator fields (modelTier, id, delegatesTo, …) survive the
 *     overlay untouched.
 */

import { describe, it, expect } from 'vitest';
import {
  applyEstateModeOverlay,
  isEstateModePersona,
} from '../personas/estate-mode-overlay.js';
import {
  ESTATE_MANAGER_TEMPLATE,
  JUNIOR_FINANCE_TEMPLATE,
} from '../personas/personas.catalog.js';
import {
  getEstateManagerMode,
  type EstateManagerModeId,
} from '../personas/estate-manager-modes.js';
import { PERSONA_IDS } from '../personas/persona.js';

// A representative free-text message that routes deterministically to each
// mode via selectEstateMode's keyword cues.
const MODE_PROBES: Record<EstateManagerModeId, string> = {
  build: 'I just signed up — where do I start setting up my 3 blocks?',
  operations: 'Triage the maintenance tickets that came in overnight.',
  finance: 'Show me the top 10 arrears cases and the proposed next step.',
  growth: 'Which units are over 30 days vacant and what should I price them at?',
  compliance: 'Are all my tax filings current for this quarter?',
};

// A distinctive marker present in each mode's specialised system_prompt body,
// used to prove the overlay folded the RIGHT mode in.
const MODE_MARKERS: Record<EstateManagerModeId, string> = {
  build: 'ANTICIPATORY',
  operations: 'NEVER SLEEPS',
  finance: 'CITE OR STAY SILENT',
  growth: 'ALWAYS HUNGRY',
  compliance: 'OWNER-ALIGNED AUTHORITY',
};

const ALL_MODES: ReadonlyArray<EstateManagerModeId> = [
  'build',
  'operations',
  'finance',
  'growth',
  'compliance',
];

describe('applyEstateModeOverlay — per-mode prompt + tool intersection', () => {
  for (const modeId of ALL_MODES) {
    it(`overlays the ${modeId} mode: prompt reflects it, tools are intersected`, () => {
      const probe = MODE_PROBES[modeId];
      const overlaid = applyEstateModeOverlay(
        ESTATE_MANAGER_TEMPLATE,
        probe,
        'en',
      );

      // --- system prompt reflects THIS mode ---------------------------------
      expect(overlaid.systemPrompt).toContain(
        `## ACTIVE MODE: ${modeId.toUpperCase()}`,
      );
      // The orchestrator base estate prompt is folded in FIRST (identity kept).
      expect(overlaid.systemPrompt).toContain('ESTATE MANAGER facet');
      // The mode's specialised operating principle is present.
      expect(overlaid.systemPrompt).toContain(MODE_MARKERS[modeId]);
      // It must NOT carry another mode's distinctive marker.
      for (const other of ALL_MODES) {
        if (other === modeId) continue;
        expect(overlaid.systemPrompt).not.toContain(MODE_MARKERS[other]);
      }

      // --- tools are the INTERSECTION (never widened) -----------------------
      const mode = getEstateManagerMode(modeId)!;
      const baseSet = new Set(ESTATE_MANAGER_TEMPLATE.allowedTools);
      const modeSet = new Set(mode.tools_allowed);

      // Every overlaid tool is in BOTH the base persona AND the mode allow-list.
      for (const tool of overlaid.allowedTools) {
        expect(baseSet.has(tool)).toBe(true);
        expect(modeSet.has(tool)).toBe(true);
      }
      // Completeness: every tool in BOTH sets appears in the result.
      for (const tool of ESTATE_MANAGER_TEMPLATE.allowedTools) {
        if (modeSet.has(tool)) {
          expect(overlaid.allowedTools).toContain(tool);
        }
      }
      // Never widened: the overlaid belt is a subset of the base belt.
      expect(overlaid.allowedTools.length).toBeLessThanOrEqual(
        ESTATE_MANAGER_TEMPLATE.allowedTools.length,
      );
      // A mode-only tool the base persona never had must NOT leak in. The
      // compose-anything meta-tool is in every mode allow-list but NOT in the
      // estate-manager template, so it is the canonical "must not widen" probe.
      expect(overlaid.allowedTools).not.toContain('compose_anything_v1');

      // --- orchestrator fields preserved -----------------------------------
      expect(overlaid.id).toBe(ESTATE_MANAGER_TEMPLATE.id);
      expect(overlaid.kind).toBe(ESTATE_MANAGER_TEMPLATE.kind);
      expect(overlaid.modelTier).toBe(ESTATE_MANAGER_TEMPLATE.modelTier);
      expect(overlaid.delegatesTo).toEqual(ESTATE_MANAGER_TEMPLATE.delegatesTo);
      expect(overlaid.minReviewRiskLevel).toBe(
        ESTATE_MANAGER_TEMPLATE.minReviewRiskLevel,
      );
      expect(overlaid.advisorHardCategories).toEqual(
        ESTATE_MANAGER_TEMPLATE.advisorHardCategories,
      );
    });
  }
});

describe('applyEstateModeOverlay — non-estate passthrough', () => {
  it('returns a NON-estate persona unchanged (same reference, no mutation)', () => {
    const before = JUNIOR_FINANCE_TEMPLATE.systemPrompt;
    const out = applyEstateModeOverlay(
      JUNIOR_FINANCE_TEMPLATE,
      'Show me the top 10 arrears cases.',
      'en',
    );
    // Flat path is byte-for-byte preserved: same object, no shaping.
    expect(out).toBe(JUNIOR_FINANCE_TEMPLATE);
    expect(out.systemPrompt).toBe(before);
    expect(out.allowedTools).toEqual(JUNIOR_FINANCE_TEMPLATE.allowedTools);
    expect(out.systemPrompt).not.toContain('## ACTIVE MODE:');
  });

  it('isEstateModePersona gates only the estate-manager persona', () => {
    expect(isEstateModePersona(PERSONA_IDS.ESTATE_MANAGER)).toBe(true);
    expect(isEstateModePersona(PERSONA_IDS.JUNIOR_FINANCE)).toBe(false);
    expect(isEstateModePersona(PERSONA_IDS.OWNER_ADVISOR)).toBe(false);
  });
});

describe('applyEstateModeOverlay — locale (EN vs SW, single-language)', () => {
  const probe = MODE_PROBES.finance;

  it('EN overlay carries the English directive and no Swahili directive', () => {
    const en = applyEstateModeOverlay(ESTATE_MANAGER_TEMPLATE, probe, 'en');
    expect(en.systemPrompt).toContain('LANGUAGE DIRECTIVE (MANDATORY)');
    expect(en.systemPrompt).toContain('Reply in English ONLY');
    // The SW directive header must be absent — single language per locale.
    expect(en.systemPrompt).not.toContain('MAAGIZO YA LUGHA');
    expect(en.systemPrompt).not.toContain('Jibu kwa Kiswahili PEKEE');
  });

  it('SW overlay carries the Swahili directive and no English directive', () => {
    const sw = applyEstateModeOverlay(ESTATE_MANAGER_TEMPLATE, probe, 'sw');
    expect(sw.systemPrompt).toContain('MAAGIZO YA LUGHA (LAZIMA)');
    expect(sw.systemPrompt).toContain('Jibu kwa Kiswahili PEKEE');
    // The EN directive header must be absent.
    expect(sw.systemPrompt).not.toContain('LANGUAGE DIRECTIVE (MANDATORY)');
    expect(sw.systemPrompt).not.toContain('Reply in English ONLY');
  });

  it('defaults to English when no locale is provided', () => {
    const def = applyEstateModeOverlay(ESTATE_MANAGER_TEMPLATE, probe);
    expect(def.systemPrompt).toContain('Reply in English ONLY');
    expect(def.systemPrompt).not.toContain('MAAGIZO YA LUGHA');
  });

  it('locale changes only the envelope, not the selected mode or tools', () => {
    const en = applyEstateModeOverlay(ESTATE_MANAGER_TEMPLATE, probe, 'en');
    const sw = applyEstateModeOverlay(ESTATE_MANAGER_TEMPLATE, probe, 'sw');
    // Same mode selected regardless of locale.
    expect(en.systemPrompt).toContain('## ACTIVE MODE: FINANCE');
    expect(sw.systemPrompt).toContain('## ACTIVE MODE: FINANCE');
    // Same tool intersection regardless of locale.
    expect(sw.allowedTools).toEqual(en.allowedTools);
  });
});

describe('applyEstateModeOverlay — immutability', () => {
  it('does not mutate the registry template', () => {
    const promptBefore = ESTATE_MANAGER_TEMPLATE.systemPrompt;
    const toolsBefore = [...ESTATE_MANAGER_TEMPLATE.allowedTools];
    applyEstateModeOverlay(ESTATE_MANAGER_TEMPLATE, MODE_PROBES.growth, 'sw');
    expect(ESTATE_MANAGER_TEMPLATE.systemPrompt).toBe(promptBefore);
    expect(ESTATE_MANAGER_TEMPLATE.allowedTools).toEqual(toolsBefore);
  });

  it('returns a frozen persona for the estate path', () => {
    const out = applyEstateModeOverlay(
      ESTATE_MANAGER_TEMPLATE,
      MODE_PROBES.build,
      'en',
    );
    expect(Object.isFrozen(out)).toBe(true);
  });
});
