/**
 * Risk Scanner — pure engine.
 *
 * Walks every rule against the resolved `RiskScannerState`, ranks by
 * `severity * 1/timeToImpactDays`, dedupes by id, and surfaces the
 * top-N risks.
 */

import type {
  Risk,
  RiskScannerState,
  RiskSeverity,
  ScanRisksOptions,
} from './types.js';
import { SEVERITY_WEIGHT, scoreRisk } from './types.js';
import { RISK_RULES } from './scan-rules.js';

const DEFAULT_LIMIT = 5;
const HARD_LIMIT = 10;

function severityAtLeast(
  severity: RiskSeverity,
  min: RiskSeverity,
): boolean {
  return SEVERITY_WEIGHT[severity] >= SEVERITY_WEIGHT[min];
}

interface RankedRisk {
  readonly risk: Risk;
  readonly score: number;
}

export function scanRisks(
  state: RiskScannerState,
  options?: ScanRisksOptions,
): ReadonlyArray<Risk> {
  const limit = Math.max(
    1,
    Math.min(options?.limit ?? DEFAULT_LIMIT, HARD_LIMIT),
  );
  const kindFilter = options?.kindFilter
    ? new Set(options.kindFilter)
    : null;
  const minSeverity = options?.minSeverity ?? 'low';
  const scopeFilter =
    options?.scopeIds && options.scopeIds.length > 0
      ? new Set(options.scopeIds)
      : null;

  const seen = new Set<string>();
  const ranked: RankedRisk[] = [];

  for (const rule of RISK_RULES) {
    if (kindFilter && !kindFilter.has(rule.kind)) continue;
    let detected = false;
    try {
      detected = rule.detect(state);
    } catch {
      detected = false;
    }
    if (!detected) continue;
    let risk: Risk;
    try {
      risk = rule.evaluate(state);
    } catch {
      continue;
    }
    if (seen.has(risk.id)) continue;
    seen.add(risk.id);

    if (!severityAtLeast(risk.severity, minSeverity)) continue;
    if (
      scopeFilter &&
      !risk.relatedScopes.some((s) => scopeFilter.has(s))
    ) {
      continue;
    }

    ranked.push({ risk, score: scoreRisk(risk) });
  }

  ranked.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const ea = a.risk.exposure ?? 0;
    const eb = b.risk.exposure ?? 0;
    if (ea !== eb) return eb - ea;
    return a.risk.id.localeCompare(b.risk.id);
  });

  return Object.freeze(ranked.slice(0, limit).map((r) => r.risk));
}

export function renderRiskHeadline(
  risk: Risk,
  locale: 'en' | 'sw',
): string {
  return risk.headline[locale];
}

export function renderRiskNarrative(
  risk: Risk,
  locale: 'en' | 'sw',
): string {
  return risk.narrative[locale];
}
