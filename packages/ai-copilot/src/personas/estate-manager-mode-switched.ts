/**
 * Estate-Manager mode-switched Master Brain persona.
 *
 * Composes the flat `manager-chat` ("Mr. Mwikila") identity with ONE of the
 * five estate modes (Build / Operations / Finance / Growth / Compliance).
 * The result is a standard `BossnyumbaPersona` so it slots into the existing
 * orchestrator + persona-router unchanged: the brain route resolves it via
 * `forcePersonaId: 'manager-chat'`, and this layer shapes the system prompt
 * and the per-mode tool allow-list around it.
 *
 * Why keep `id: 'manager-chat'`? The orchestrator + `assertStatelessInDev`
 * guard validate against the closed `BossnyumbaPersonaId` union and the
 * six-field identity shape. The mode is NOT a new persona — it is the SAME
 * Mr. Mwikila wearing a mode costume — so the composed persona keeps the
 * canonical id and surfaces the active mode through `displayName` only. The
 * mode's mandate + specialised prompt + tool allow-list ride inside the
 * `systemPrompt` / `availableTools`.
 *
 * Pure value module — no I/O. Stateless: every call rebuilds a frozen
 * persona from the (cached) base identity + the requested mode. Currency-
 * and jurisdiction-neutral; the persona prompt never names a currency.
 */

import type { BossnyumbaPersona } from './persona-types.js';
import { createManagerChat } from './manager-chat.js';
import {
  ESTATE_MANAGER_MODES,
  getEstateManagerMode,
  type EstateManagerMode,
  type EstateManagerModeId,
} from './estate-manager-modes.js';

/**
 * The default mode when intent is ambiguous. Operations is the daily-driver
 * surface — most admin chatter is operational — so an unrouted message lands
 * there rather than in a setup or filing flow.
 */
export const DEFAULT_ESTATE_MODE: EstateManagerModeId = 'operations';

/**
 * Deterministic intent -> mode router. No LLM cost, O(1) over a small rule
 * set. Bilingual: each mode carries EN + SW keyword cues so a Swahili
 * message routes as well as an English one. The brain may still override the
 * pick with an explicit mode selector; this is the zero-cost default.
 *
 * Ordering: the first mode whose cues match wins, in Build -> Compliance ->
 * Finance -> Growth -> Operations priority. Operations is last because it is
 * the catch-all default; the more specific modes claim their intents first.
 */
const MODE_CUES: ReadonlyArray<{
  readonly mode: EstateManagerModeId;
  readonly cues: ReadonlyArray<RegExp>;
}> = [
  {
    mode: 'build',
    cues: [
      /\b(set ?up|setting up|onboard|onboarding|get started|import|rent roll|migrate|register (a )?(property|unit))\b/i,
      /\b(nianzie|kuweka|usajili|pakia|kuanza|kusajili)\b/i,
    ],
  },
  {
    mode: 'compliance',
    cues: [
      /\b(compliance|complian|filing|file (a|my|the)|tax|certificate|licen[cs]e|audit|statutory|regulator|expir)\b/i,
      /\b(kodi ya serikali|cheti|leseni|ukaguzi|sheria|kufuata sheria|fomu ya kodi)\b/i,
    ],
  },
  {
    mode: 'finance',
    cues: [
      /\b(arrears|rent collection|reconcil|noi|opex|cash|payout|statement|balance|invoice|burn)\b/i,
      /\b(malimbikizo|kukusanya kodi|fedha|pesa|taarifa ya fedha|salio|ankara)\b/i,
    ],
  },
  {
    mode: 'growth',
    cues: [
      /\b(vacancy|vacant|occupancy|renewal|renew|under ?market|raise rent|acquire|acquisition|pricing|price)\b/i,
      /\b(wazi|nafasi wazi|kuendeleza mkataba|kupandisha kodi|bei|kununua|soko)\b/i,
    ],
  },
  {
    mode: 'operations',
    cues: [
      /\b(maintenance|repair|leak|ticket|complaint|inspection|move-?in|move-?out|incident|vendor|dispatch)\b/i,
      /\b(matengenezo|ukarabati|uvujaji|tiketi|malalamiko|ukaguzi|tukio|fundi)\b/i,
    ],
  },
];

/**
 * Pick the estate mode for a free-text message. Pure + total — every input
 * yields a defined mode (falls back to {@link DEFAULT_ESTATE_MODE}). Exported
 * for unit tests and the brain route's mode pre-selection.
 */
export function selectEstateMode(text: string): EstateManagerModeId {
  const t = (text ?? '').trim();
  if (t.length === 0) return DEFAULT_ESTATE_MODE;
  for (const { mode, cues } of MODE_CUES) {
    if (cues.some((rx) => rx.test(t))) return mode;
  }
  return DEFAULT_ESTATE_MODE;
}

/**
 * The active mode is surfaced through the display name so the owner UI can
 * show which costume Mr. Mwikila is wearing without a schema change. Kept as
 * a plain prefix (no ids / tokens) so `assertStatelessInDev` stays happy.
 */
function modeDisplayName(base: string, mode: EstateManagerMode): string {
  return `${base} — ${mode.name}`;
}

/**
 * Compose the final system prompt: the base manager-chat identity FIRST
 * (who Mr. Mwikila is), then a clear mode envelope (the active mandate +
 * specialised directives). The mode body already carries the universal
 * evidence + hard-rule scaffold, so this is a straight concatenation.
 */
function composeSystemPrompt(basePrompt: string, mode: EstateManagerMode): string {
  return [
    basePrompt.trim(),
    '',
    '---',
    `## ACTIVE MODE: ${mode.name.toUpperCase()}`,
    '',
    mode.system_prompt.trim(),
  ].join('\n');
}

/**
 * The mode's narrow tool allow-list, intersected with what the base
 * manager-chat identity is allowed to call PLUS the mode's own
 * domain/compose tools. We start from the mode allow-list (the narrowing
 * lever) and union it with the base identity's portfolio-read tools so the
 * master brain never loses its always-available situational-awareness
 * tools. De-duplicated, frozen.
 */
function composeAvailableTools(
  baseTools: ReadonlyArray<string>,
  mode: EstateManagerMode,
): ReadonlyArray<string> {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const tool of [...baseTools, ...mode.tools_allowed]) {
    if (seen.has(tool)) continue;
    seen.add(tool);
    merged.push(tool);
  }
  return Object.freeze(merged);
}

/**
 * Build the mode-switched estate-manager persona for a given mode. Returns a
 * standard frozen `BossnyumbaPersona` (id stays `manager-chat`) whose prompt
 * and tools are shaped by the selected mode. Throws on an unknown mode id so
 * a typo surfaces loudly rather than silently defaulting.
 */
export function buildEstateManagerModePersona(
  modeId: EstateManagerModeId,
): BossnyumbaPersona {
  const mode = getEstateManagerMode(modeId);
  if (!mode) {
    throw new Error(
      `buildEstateManagerModePersona: unknown estate mode "${modeId}"`,
    );
  }
  const base = createManagerChat();
  return Object.freeze({
    id: base.id,
    displayName: modeDisplayName(base.displayName, mode),
    portalId: base.portalId,
    systemPrompt: composeSystemPrompt(base.systemPrompt, mode),
    availableTools: composeAvailableTools(base.availableTools, mode),
    communicationStyle: base.communicationStyle,
  });
}

/**
 * Convenience: route a message to its mode, then build the persona for it.
 * The single call the brain route uses to turn "what the owner typed" into
 * "the mode-shaped Mr. Mwikila persona to run this turn with".
 */
export function resolveEstateManagerPersonaForText(text: string): {
  readonly mode: EstateManagerModeId;
  readonly persona: BossnyumbaPersona;
} {
  const mode = selectEstateMode(text);
  return { mode, persona: buildEstateManagerModePersona(mode) };
}

/** All five mode personas, pre-built and frozen. Useful for tests / roster. */
export function getAllEstateManagerModePersonae(): ReadonlyArray<{
  readonly mode: EstateManagerModeId;
  readonly persona: BossnyumbaPersona;
}> {
  return Object.freeze(
    ESTATE_MANAGER_MODES.map((m) => ({
      mode: m.id,
      persona: buildEstateManagerModePersona(m.id),
    })),
  );
}
