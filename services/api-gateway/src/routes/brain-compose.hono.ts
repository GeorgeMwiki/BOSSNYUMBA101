/**
 * /api/v1/brain/compose/suggest — smart-compose ghost-text (Gap 7).
 *
 * Receives the user's in-progress composer input and returns a single-line
 * completion the UI renders as dim "ghost" text. Tab accepts; any keystroke
 * cancels. The completion is the SHORTEST plausible continuation — never
 * more than ~60 characters — because anything longer fights the user's
 * intent.
 *
 * Language follows the caller's preferred language. BossNyumba default is
 * English (`en`); Tanzanian users can toggle to Swahili (`sw`). The toggle
 * is ABSOLUTE — one language per suggestion, never mixed.
 *
 * Retargeted from Borjie's mining completions to the estate domain: the
 * lookup table covers the top owner/admin intents (arrears, rent, NOI,
 * vacancy, renewals, inspections, maintenance, compliance).
 *
 * Wire shape:
 *   POST /brain/compose/suggest
 *     { text: string, language?: 'en' | 'sw' }
 *   ->
 *     { success: true, data: { suggestion: string, cached: boolean } }
 *
 * A curated lookup table fronts the path (runs in <5 ms — important for the
 * keystroke debounce). No LLM call on this hot path; an unmatched prefix
 * returns an empty suggestion (the composer simply shows no ghost text),
 * never a fabricated completion. Mounted ADDITIVELY; does not touch /brain.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { getSharedPerTenantRateBudget } from '../middleware/per-tenant-rate-budget';

const SuggestRequest = z.object({
  text: z.string().min(1).max(2000),
  // English default per CLAUDE.md.
  language: z.enum(['en', 'sw']).default('en'),
});

// ----------------------------------------------------------------------------
// Curated prefix -> completion lookup table (estate domain).
// ----------------------------------------------------------------------------
//
// Each entry maps a normalised prefix to its bilingual completions. The match
// is case-insensitive, trims trailing punctuation, and prefers the LONGEST
// matching prefix so "what is the cash" beats "what". Completions are
// currency- and jurisdiction-neutral (no hard-coded KES/TZS/UGX/NGN).
//
// New entries land here when an intent is observed in the production query
// corpus more than ~50x / week.

interface CompletionPair {
  readonly en: string;
  readonly sw: string;
}

const SUGGESTIONS: ReadonlyArray<[string, CompletionPair]> = [
  ['arrears', { en: ' aging report this month', sw: ' ripoti ya umri wa madeni mwezi huu' }],
  ['rent collection', { en: ' rate across all properties', sw: ' kiwango kwenye majengo yote' }],
  ['rent roll', { en: ' for the current period', sw: ' kwa kipindi cha sasa' }],
  ['cash', { en: ' position across the portfolio', sw: ' hali ya fedha kwenye portfolio' }],
  ['cash runway', { en: ' for the next 30 days', sw: ' kwa siku 30 zijazo' }],
  ['noi', { en: ' for this property last quarter', sw: ' ya jengo hili robo iliyopita' }],
  ['vacancy', { en: ' aging across my units', sw: ' umri wa vyumba vilivyo wazi' }],
  ['occupancy', { en: ' rate this month vs last', sw: ' kiwango mwezi huu dhidi ya uliopita' }],
  ['lease renewal', { en: ' offers due in the next 90 days', sw: ' ofa zinazostahili siku 90 zijazo' }],
  ['renewals', { en: ' ending in the next 90 days', sw: ' zinazoisha siku 90 zijazo' }],
  ['maintenance', { en: ' tickets open right now', sw: ' tiketi zilizo wazi sasa hivi' }],
  ['inspection', { en: ' schedule for this month', sw: ' ratiba ya ukaguzi mwezi huu' }],
  ['compliance', { en: ' obligations due this quarter', sw: ' majukumu yanayostahili robo hii' }],
  ['certificate', { en: ' renewals expiring in 60 days', sw: ' vyeti vinavyoisha muda siku 60' }],
  ['filing', { en: ' status for this period', sw: ' hali ya mawasilisho kwa kipindi hiki' }],
  ['who', { en: ' are my top arrears tenants?', sw: ' ni wapangaji wenye madeni makubwa zaidi?' }],
  ['how much', { en: ' rent did I collect this month?', sw: ' kodi nilikusanya mwezi huu?' }],
  ['what are', { en: ' my top decisions today?', sw: ' maamuzi yangu makuu leo?' }],
  ['what is', { en: ' my cash runway?', sw: ' nafasi yangu ya fedha?' }],
  ['show me', { en: ' the portfolio overview', sw: ' muhtasari wa portfolio' }],
  ['remind me', { en: ' to review this quarter\'s filing', sw: ' kukagua mawasilisho ya robo hii' }],
  ['draft', { en: ' a renewal offer for this unit', sw: ' ofa ya kuendeleza mkataba wa chumba hiki' }],
  ['summarise', { en: ' the past week for me', sw: ' wiki iliyopita kwangu' }],
  ['summarize', { en: ' the past week for me', sw: ' wiki iliyopita kwangu' }],
  ['nina', { en: '', sw: ' wapangaji wenye madeni ninaohitaji kufuatilia' }],
  ['tunahitaji', { en: '', sw: ' kuongea kuhusu malipo ya mwezi huu' }],
  ['ninaomba', { en: '', sw: ' muhtasari wa portfolio' }],
];

function normaliseInput(text: string): string {
  return text.toLowerCase().trim().replace(/[?.!,]+$/, '');
}

/** Pure function exported for unit tests. */
export function lookupSuggestion(
  rawText: string,
  language: 'en' | 'sw',
): { readonly suggestion: string; readonly cached: boolean } {
  const normalised = normaliseInput(rawText);
  if (normalised.length === 0) {
    return { suggestion: '', cached: true };
  }
  // Prefer the longest match — sort descending by key length.
  const ranked = [...SUGGESTIONS].sort(([a], [b]) => b.length - a.length);
  for (const [prefix, pair] of ranked) {
    if (
      normalised === prefix ||
      normalised.startsWith(`${prefix} `) ||
      normalised.endsWith(prefix)
    ) {
      const completion = language === 'sw' ? pair.sw : pair.en;
      if (completion.length > 0) {
        return { suggestion: completion, cached: true };
      }
    }
  }
  return { suggestion: '', cached: true };
}

// ----------------------------------------------------------------------------
// Hono router
// ----------------------------------------------------------------------------

export const brainComposeRouter = new Hono();
brainComposeRouter.use('*', authMiddleware);
brainComposeRouter.use('*', getSharedPerTenantRateBudget({ surface: 'brain' }).handler);

brainComposeRouter.post(
  '/compose/suggest',
  zValidator('json', SuggestRequest),
  async (c) => {
    const body = c.req.valid('json');
    const result = lookupSuggestion(body.text, body.language);
    return c.json({
      success: true,
      data: {
        suggestion: result.suggestion,
        cached: result.cached,
      },
    });
  },
);

export default brainComposeRouter;
