/**
 * Opportunity Scanner — engine (real-estate domain).
 *
 * Walks every rule in `SCAN_RULES` against the resolved tenant
 * `ScanState`, returns the top N ranked opportunities. Pure function,
 * no I/O — the resolver layer above is responsible for building the
 * `ScanState`.
 *
 * Ranking: rules are scored by `expectedValue × confidence × time
 * urgency` where time urgency is `clamp(30 / max(timeWindowDays, 1),
 * 0, 3)` so a 7-day window outranks a 60-day window of equal value.
 *
 * Caps at 3-5 per scan (configurable, default 3). Deduplicates by id.
 * Filter helpers let callers narrow by kind or minimum value.
 */

import type { Opportunity, OpportunityKind, ScanState } from './types.js';
import { OpportunitySchema } from './types.js';
import { SCAN_RULES } from './scan-rules.js';

export interface ScanOptions {
  readonly maxResults?: number;
  readonly minExpectedValue?: number;
  readonly kindFilter?: ReadonlyArray<OpportunityKind>;
  readonly scopeIds?: ReadonlyArray<string>;
}

const DEFAULT_MAX_RESULTS = 3;
const HARD_MAX_RESULTS = 5;
const NULL_EV_FLOOR = 5_000_000;

interface RankedOpportunity {
  readonly opportunity: Opportunity;
  readonly score: number;
}

function urgencyMultiplier(timeWindowDays: number): number {
  if (timeWindowDays <= 0) return 1;
  const raw = 30 / Math.max(timeWindowDays, 1);
  if (raw > 3) return 3;
  if (raw < 0.25) return 0.25;
  return raw;
}

function scoreOpportunity(o: Opportunity): number {
  const value = Math.max(0, o.expectedValue ?? 0);
  const confidence = Math.max(0, Math.min(1, o.confidence));
  const urgency = urgencyMultiplier(o.timeWindowDays);
  const floor = o.expectedValue == null ? NULL_EV_FLOOR : 0;
  return (value + floor) * confidence * urgency;
}

/**
 * Walk every rule, evaluate the matches, dedupe + rank, and return the
 * top opportunities. Pure function over the supplied `ScanState`.
 */
export function scanOpportunities(
  state: ScanState,
  options?: ScanOptions,
): ReadonlyArray<Opportunity> {
  const maxResults = Math.max(
    1,
    Math.min(options?.maxResults ?? DEFAULT_MAX_RESULTS, HARD_MAX_RESULTS),
  );
  const minValue = options?.minExpectedValue ?? 0;
  const kindFilter = options?.kindFilter
    ? new Set<string>(options.kindFilter)
    : null;
  const scopeFilter = options?.scopeIds && options.scopeIds.length > 0
    ? new Set(options.scopeIds)
    : null;

  const seen = new Set<string>();
  const ranked: RankedOpportunity[] = [];

  for (const rule of SCAN_RULES) {
    if (kindFilter && !kindFilter.has(rule.kind)) continue;
    let detected = false;
    try {
      detected = rule.detect(state);
    } catch {
      detected = false;
    }
    if (!detected) continue;

    let raw: Opportunity;
    try {
      raw = rule.evaluate(state);
    } catch {
      continue;
    }
    const parsed = OpportunitySchema.safeParse(raw);
    if (!parsed.success) continue;
    const opportunity = parsed.data;
    if (seen.has(opportunity.id)) continue;
    seen.add(opportunity.id);

    if (opportunity.expectedValue != null && opportunity.expectedValue < minValue) {
      continue;
    }
    if (
      scopeFilter &&
      !opportunity.relatedScopes.some((s) => scopeFilter.has(s))
    ) {
      continue;
    }

    ranked.push({ opportunity, score: scoreOpportunity(opportunity) });
  }

  ranked.sort((a, b) => b.score - a.score);
  return Object.freeze(ranked.slice(0, maxResults).map((r) => r.opportunity));
}

/**
 * Render an opportunity to the locale-specific narrative string.
 */
export function renderOpportunityNarrative(
  opportunity: Opportunity,
  locale: 'en' | 'sw',
): string {
  return opportunity.narrative[locale];
}

/**
 * Render an opportunity to a flat headline for cards / chips.
 */
export function renderOpportunityHeadline(
  opportunity: Opportunity,
  locale: 'en' | 'sw',
): string {
  return opportunity.headline[locale];
}
