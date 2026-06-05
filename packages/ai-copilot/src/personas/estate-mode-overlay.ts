/**
 * Estate-mode overlay adapter — make the PRIMARY `/api/v1/brain/turn` route
 * estate-mode-aware without changing the orchestrator's persona TYPE.
 *
 * The Brain runs on the orchestrator `Persona` shape (id, modelTier,
 * delegatesTo, advisor gates, …). Gap-5's mode-switching, however, lives on
 * the portal `BossnyumbaPersona` shape and was only ever applied by the
 * `/teach` route. This module bridges the two WITHOUT a type conversion: it
 * takes the orchestrator `Persona` the turn already resolved and OVERLAYS the
 * selected estate mode's specialised system-prompt body + tool allow-list onto
 * it, returning a NEW frozen `Persona` that preserves every orchestrator field
 * (modelTier, id, delegatesTo, advisor categories, visibility, …).
 *
 * It is an OVERLAY / FOLD, not a full conversion:
 *   - systemPrompt := locale envelope (EN or SW, single-language) + the base
 *     estate prompt + the active mode's specialised body.
 *   - allowedTools := the INTERSECTION of the base persona's tools and the
 *     mode's allow-list (NEVER widened — the mode is a narrowing lever).
 *   - every other field is carried through unchanged.
 *
 * No-op safety: the overlay returns the persona UNCHANGED unless it is the
 * estate-manager (admin-facing) persona. The flat path for every other persona
 * is therefore byte-for-byte preserved.
 *
 * Pure value module — no I/O, no Drizzle, no Anthropic SDK. Immutable: the
 * registry template is never mutated; a fresh frozen object is returned.
 * Currency- and jurisdiction-neutral (it never names a currency or country).
 * Single-language per locale — the envelope forbids the other language.
 */

import { Persona, PERSONA_IDS } from './persona.js';
import {
  getEstateManagerMode,
  type EstateManagerModeId,
  type EstateManagerLanguage,
} from './estate-manager-modes.js';
import { selectEstateMode } from './estate-manager-mode-switched.js';

/**
 * Persona ids the overlay applies to. The estate-manager IS the admin-facing
 * master brain; it is the persona `/turn` resolves for owner/admin chat. Kept
 * as a frozen set so the gate is O(1) and a future admin alias can be added in
 * one place.
 */
const ESTATE_MODE_PERSONA_IDS: ReadonlySet<string> = new Set([
  PERSONA_IDS.ESTATE_MANAGER,
]);

/**
 * True when the overlay should shape this persona. Exported so call sites /
 * tests can branch without re-deriving the rule.
 */
export function isEstateModePersona(personaId: string): boolean {
  return ESTATE_MODE_PERSONA_IDS.has(personaId);
}

/**
 * Strict single-language directive. Prepended to the folded prompt so the
 * persona answers in exactly ONE language regardless of the language the base
 * estate prompt or the mode body happen to be authored in. The mode bodies are
 * language-neutral by design (see estate-manager-modes.ts); this envelope is
 * what renders the active locale — mirroring how the `/teach` route picks an EN
 * or SW base envelope and folds the mode prompt inside it.
 */
function localeEnvelope(locale: EstateManagerLanguage): string {
  if (locale === 'sw') {
    return [
      'MAAGIZO YA LUGHA (LAZIMA): Jibu kwa Kiswahili PEKEE. Usichanganye lugha',
      'kamwe ndani ya jibu moja. Usianze kwa salamu ya Kiingereza. Maelekezo',
      'ya mfumo hapa chini yanaweza kuwa kwa Kiingereza — yatekeleze, lakini',
      'jibu lako kwa mtumiaji liwe kwa Kiswahili tu.',
    ].join('\n');
  }
  return [
    'LANGUAGE DIRECTIVE (MANDATORY): Reply in English ONLY. Never mix',
    'languages within a single reply. Never open with a Swahili greeting.',
    'The system instructions below may be authored in English — follow them,',
    'and keep your reply to the user in English only.',
  ].join('\n');
}

/**
 * Fold the base persona prompt with the active mode's specialised body under a
 * single-language envelope. The base prompt comes FIRST (who the brain is),
 * then the explicit mode envelope (the active mandate + specialised
 * directives). The mode body already carries the universal evidence + hard-rule
 * scaffold, so this is a structured concatenation, not a re-derivation.
 */
function composeOverlaidPrompt(args: {
  readonly locale: EstateManagerLanguage;
  readonly basePrompt: string;
  readonly modeName: string;
  readonly modePrompt: string;
}): string {
  return [
    localeEnvelope(args.locale),
    '',
    args.basePrompt.trim(),
    '',
    '---',
    `## ACTIVE MODE: ${args.modeName.toUpperCase()}`,
    '',
    args.modePrompt.trim(),
  ].join('\n');
}

/**
 * Intersect the base persona's tools with the mode's allow-list. The result is
 * the set of tools that are BOTH granted to the orchestrator persona AND in
 * scope for the active mode — the mode can only ever NARROW the tool-belt, it
 * can never widen it. Order follows the base persona's declaration (stable for
 * snapshots); duplicates are dropped.
 */
function intersectTools(
  baseTools: ReadonlyArray<string>,
  modeAllowList: ReadonlyArray<string>,
): string[] {
  const allowed = new Set(modeAllowList);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tool of baseTools) {
    if (!allowed.has(tool)) continue;
    if (seen.has(tool)) continue;
    seen.add(tool);
    out.push(tool);
  }
  return out;
}

/**
 * Overlay the selected estate mode onto an orchestrator `Persona`.
 *
 * Behaviour:
 *  - NO-OP (returns `persona` unchanged) unless `persona.id` is the
 *    estate-manager / admin persona — preserving the flat path for everyone
 *    else byte-for-byte.
 *  - Otherwise: selects the mode from `userText` (deterministic, no LLM cost),
 *    folds the mode's specialised body onto the base prompt under the active
 *    locale envelope, and intersects the tool-belt with the mode's allow-list.
 *  - Returns a NEW frozen `Persona` preserving every other field (id, kind,
 *    modelTier, delegatesTo, advisor gates, visibility, tenant/team binding…).
 *
 * `locale` defaults to English (the BossNyumba default per CLAUDE.md). An
 * unknown mode id from the selector is impossible (the selector is total), but
 * if the mode lookup ever returns null the persona is returned unchanged so a
 * registry/catalog drift degrades to the flat persona rather than throwing on
 * the hot turn path.
 */
export function applyEstateModeOverlay(
  persona: Persona,
  userText: string,
  locale: EstateManagerLanguage = 'en',
): Persona {
  // Gate: only the estate-manager / admin persona is mode-switched.
  if (!isEstateModePersona(persona.id)) return persona;

  const modeId: EstateManagerModeId = selectEstateMode(userText ?? '');
  const mode = getEstateManagerMode(modeId);
  // Defensive: catalog drift -> degrade to the flat persona, never throw on
  // the turn hot path.
  if (!mode) return persona;

  const overlaid: Persona = {
    ...persona,
    systemPrompt: composeOverlaidPrompt({
      locale,
      basePrompt: persona.systemPrompt,
      modeName: mode.name,
      modePrompt: mode.system_prompt,
    }),
    allowedTools: intersectTools(persona.allowedTools, mode.tools_allowed),
  };

  return Object.freeze(overlaid);
}
