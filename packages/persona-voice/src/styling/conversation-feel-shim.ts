/**
 * PORT-SHIM: @bossnyumba/conversation-feel lacks `applyConversationFeel`
 * and a `Locale` type; local stub for build-green, reconcile at live-wiring.
 *
 * Why a shim and not a plain rename: the dep DOES export a single-input
 * filler/apology stripper (`stripChatbotFeel(input): StrippedResponse`), but
 * (a) it returns `{ stripped }`, not the `{ text }` shape the styler consumes,
 * (b) it is English-only — it has no locale concept at all. The persona styler
 * contract is fail-open AND locale-pure: under `sw` only Swahili rules run (no
 * English filler is touched and none is injected), under `en` only English
 * rules run. We therefore wrap the dep's battle-tested English guards for `en`
 * and add a minimal Swahili opener/apology pass for `sw`, normalising the
 * result to `{ text }`. At live-wiring, replace this with a real locale-aware
 * output stage exported from the dep.
 */

import { stripChatbotFeel } from '@bossnyumba/conversation-feel';

/** Active reply language. The platform launches bilingual sw/en. */
export type Locale = 'en' | 'sw';

/** Normalised output of a conversation-feel pass: cleaned substance only. */
export interface ConversationFeelResult {
  readonly text: string;
}

/**
 * Minimal Swahili filler/apology rules. Kept deliberately small — this mirrors
 * the *shape* of the dep's English opener rules for the launch locale until the
 * dep ships its own locale-aware guards. Each rule strips a leading filler
 * opener or a theatrical apology clause without disturbing substance.
 */
const SW_FILLER_RULES: ReadonlyArray<RegExp> = [
  // Praise-the-question openers: "Swali zuri!", "Swali nzuri,".
  /^\s*swali\s+(zuri|nzuri|jema)[!,.\s]+/iu,
  // Enthusiastic acknowledgments: "Bila shaka,", "Hakika!", "Kwa hakika,".
  /^\s*(bila\s+shaka|hakika|kwa\s+hakika|bila\s+ya\s+shaka)[!,.\s]+/iu,
  // Theatrical apology clause: "Samahani sana, lakini ...".
  /\b(samahani\s+sana|naomba\s+radhi\s+sana),?\s+(lakini|ila)\s+/iu,
];

function applySwahili(input: string): string {
  let working = input;
  for (const rule of SW_FILLER_RULES) {
    working = working.replace(rule, '');
  }
  return working.trim();
}

/**
 * Run the locale's conversation-feel output stage on a model-produced body.
 *
 * Fail-open: any thrown guard returns the body unchanged — a guard can never
 * break or drop a reply. Locale-pure: rules for `locale` only; the other
 * language is never injected.
 */
export function applyConversationFeel(
  body: string,
  locale: Locale,
): ConversationFeelResult {
  try {
    if (locale === 'sw') {
      return { text: applySwahili(body) };
    }
    // `en` (and any future default): reuse the dep's English guards.
    return { text: stripChatbotFeel(body).stripped };
  } catch {
    // Fail-open: never break or drop the reply on a guard error.
    return { text: body };
  }
}
