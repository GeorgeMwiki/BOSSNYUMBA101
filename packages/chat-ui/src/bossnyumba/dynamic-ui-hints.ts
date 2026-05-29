/**
 * BossNyumba dynamic-UI hint catalogue — ported from Borjie's DU-2 fix,
 * retailored for real-estate (rent collection / maintenance / tenant
 * relations / lease admin) instead of mining.
 *
 * The ProactiveHint, MasteryGate, and LearnedShortcutsPanel components
 * in `packages/chat-ui/src/components/` are domain-neutral by design
 * (they ship into BossNyumba + Borjie + other consumers). This module
 * supplies the BOSSNYUMBA-SPECIFIC bilingual (sw/en) hint copy and
 * mastery-gate strings so apps can wire them with a single import.
 *
 * Apps consume:
 *
 *   import {
 *     bossnyumbaProactiveHints,
 *     bossnyumbaMasteryGateCopy,
 *     bossnyumbaLearnedShortcutsHeadline,
 *   } from '@bossnyumba/chat-ui';
 *
 *   <ProactiveHint
 *     profile={profile}
 *     hints={bossnyumbaProactiveHints(language)}
 *     dismissAriaLabel={language === 'sw' ? 'Funga' : 'Dismiss'}
 *   />
 *
 * Bilingual contract:
 *   - Every string ships sw + en. Picker `(lang: 'sw'|'en') => string`.
 *   - Default language is `sw` per BossNyumba persona rule (Mr. Mwikila is
 *     a Swahili-first agent).
 *   - Copy is concise; the panel renders a single line.
 *
 * Why this lives in chat-ui: the same catalogue is consumed by
 * owner-portal AND tenant-portal AND mobile apps so the hint experience
 * is consistent across surfaces. App-local overrides remain possible —
 * callers pass a custom HintCandidate[] when they want a surface-specific
 * message.
 */

import type { HintCandidate } from '../components/ProactiveHint.js';

/**
 * Local alias used only inside this module's signatures. Structurally
 * identical to BossNyumbaLanguage in `./useBossNyumbaChat`.
 */
type BossNyumbaLanguageLocal = 'sw' | 'en';

/**
 * Build the BossNyumba default ProactiveHint catalogue for the given
 * language. Returned array is frozen so callers can't mutate it.
 *
 * The catalogue covers the four canonical TOM triggers:
 *   - frustration ≥ 0.5  → "Talk to a human?" hand-off
 *   - comprehension ≤ 0.4 → "Explain simply" rewrite
 *   - anxiety ≥ 0.6       → "Your data is safe." reassurance
 *   - idle (parent-driven) → "Try Cmd-K" passive teaching
 *
 * Action `emit` strings are stable identifiers — apps switch/case on
 * them in their `proactive-hint:action` event listener. NEVER eval.
 */
export function bossnyumbaProactiveHints(
  language: BossNyumbaLanguageLocal,
): ReadonlyArray<HintCandidate> {
  if (language === 'sw') {
    return Object.freeze([
      Object.freeze<HintCandidate>({
        id: 'bossnyumba.frustration.handoff',
        trigger: 'frustration',
        threshold: 0.5,
        title: 'Inaonekana hii inachukua muda mrefu kuliko ulivyotarajia.',
        body: 'Ungependa kuongea na meneja wa Bossnyumba?',
        action: { label: 'Ongea na meneja', emit: 'bossnyumba:handoff:human' },
      }),
      Object.freeze<HintCandidate>({
        id: 'bossnyumba.comprehension.simpler',
        trigger: 'comprehension',
        threshold: 0.4,
        title: 'Je, niielezee kwa lugha rahisi zaidi?',
        body: 'Ninaweza kuvunja maelezo hatua kwa hatua.',
        action: {
          label: 'Elezea kwa urahisi',
          emit: 'bossnyumba:explain:simpler',
        },
      }),
      Object.freeze<HintCandidate>({
        id: 'bossnyumba.anxiety.safety',
        trigger: 'anxiety',
        threshold: 0.6,
        title: 'Data yako iko salama.',
        body: 'Sifanyi vitendo visivyoweza kurudishwa bila ruhusa yako.',
      }),
      Object.freeze<HintCandidate>({
        id: 'bossnyumba.idle.cmdk',
        trigger: 'idle',
        threshold: 0,
        title: 'Kidokezo: Cmd-K hufungua paji ya amri.',
        body: 'Tafuta menyu, mali, na taarifa kwa haraka.',
        action: { label: 'Funza', emit: 'bossnyumba:teach:cmdk' },
      }),
    ]) as ReadonlyArray<HintCandidate>;
  }
  return Object.freeze([
    Object.freeze<HintCandidate>({
      id: 'bossnyumba.frustration.handoff',
      trigger: 'frustration',
      threshold: 0.5,
      title: 'Looks like this is taking longer than expected.',
      body: 'Want to chat with a BossNyumba team member?',
      action: { label: 'Talk to a human', emit: 'bossnyumba:handoff:human' },
    }),
    Object.freeze<HintCandidate>({
      id: 'bossnyumba.comprehension.simpler',
      trigger: 'comprehension',
      threshold: 0.4,
      title: 'Want me to explain this in simpler terms?',
      body: 'I can break this down step by step.',
      action: {
        label: 'Explain simply',
        emit: 'bossnyumba:explain:simpler',
      },
    }),
    Object.freeze<HintCandidate>({
      id: 'bossnyumba.anxiety.safety',
      trigger: 'anxiety',
      threshold: 0.6,
      title: 'Your data is safe.',
      body: 'I never run irreversible actions without your confirmation.',
    }),
    Object.freeze<HintCandidate>({
      id: 'bossnyumba.idle.cmdk',
      trigger: 'idle',
      threshold: 0,
      title: 'Tip: Cmd-K opens the command palette.',
      body: 'Find menus, properties, and insights in one keystroke.',
      action: { label: 'Show me', emit: 'bossnyumba:teach:cmdk' },
    }),
  ]) as ReadonlyArray<HintCandidate>;
}

/**
 * MasteryGate locked-state copy. The component itself interpolates
 * `{level}` into the template; this catalogue swaps the template per
 * language so the entire string is bilingual.
 */
export interface BossNyumbaMasteryGateCopy {
  readonly hintTemplate: string;
  readonly dismissAriaLabel: string;
}

export function bossnyumbaMasteryGateCopy(
  language: BossNyumbaLanguageLocal,
): BossNyumbaMasteryGateCopy {
  if (language === 'sw') {
    return Object.freeze({
      hintTemplate: 'Hupatikana ukifikia kiwango cha {level}',
      dismissAriaLabel: 'Funga kidokezo',
    });
  }
  return Object.freeze({
    hintTemplate: 'Unlocks at {level} level',
    dismissAriaLabel: 'Dismiss hint',
  });
}

/**
 * LearnedShortcutsPanel headline copy — bilingual.
 *
 * Owner-portal + tenant-portal + mobile apps use the same panel; all
 * wire this helper for consistent "Your shortcuts" / "Njia zako za mkato"
 * copy.
 */
export function bossnyumbaLearnedShortcutsHeadline(
  language: BossNyumbaLanguageLocal,
): string {
  return language === 'sw' ? 'Njia zako za mkato' : 'Your shortcuts';
}
