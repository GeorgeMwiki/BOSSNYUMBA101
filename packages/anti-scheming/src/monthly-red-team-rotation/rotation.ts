/**
 * Monthly red-team rotation logic.
 *
 * The rotation guarantees:
 *   - 10 new scenarios per month (configurable)
 *   - Authored by >= 3 distinct people in any given month
 *   - No single author writes > 40% of scenarios over a 90-day window
 *
 * Adversary model: an insider with a single author identity should not
 * be able to single-handedly shape the eval set the brain is judged
 * against.
 */

import type {
  RedTeamScenarioDraft,
  RotationGuardReport,
  RotationLedger,
  RotationLedgerEntry,
} from './types.js';

export interface MonthlyRotationRequirement {
  readonly target_per_month: number; // default 10
  readonly min_unique_authors_per_month: number; // default 3
  readonly max_author_share_window_days: number; // default 90
  readonly max_author_share_threshold: number; // default 0.4
}

export const DEFAULT_REQUIREMENT: MonthlyRotationRequirement = Object.freeze({
  target_per_month: 10,
  min_unique_authors_per_month: 3,
  max_author_share_window_days: 90,
  max_author_share_threshold: 0.4,
});

/**
 * Validate a batch of drafts before they are written to disk + signed.
 *
 * Returns a list of human-readable problems. Empty array ⇒ accept.
 */
export function validateMonthlyBatch(
  drafts: readonly RedTeamScenarioDraft[],
  requirement: MonthlyRotationRequirement = DEFAULT_REQUIREMENT,
): string[] {
  const problems: string[] = [];
  if (drafts.length < requirement.target_per_month) {
    problems.push(`only ${drafts.length} drafts; need >= ${requirement.target_per_month}`);
  }
  const authors = new Set(drafts.map(d => d.author_id));
  if (authors.size < requirement.min_unique_authors_per_month) {
    problems.push(`only ${authors.size} unique authors; need >= ${requirement.min_unique_authors_per_month}`);
  }
  // Inputs must be non-empty + non-duplicate
  const inputs = new Set<string>();
  for (const d of drafts) {
    if (!d.input.trim()) problems.push(`empty input for author=${d.author_id}`);
    if (inputs.has(d.input)) problems.push(`duplicate input: ${d.input.slice(0, 50)}…`);
    inputs.add(d.input);
    if (d.forbidden_actions.length === 0) problems.push(`scenario by ${d.author_id} has no forbidden_actions`);
  }
  return problems;
}

/**
 * Audit the rolling 90-day window in the ledger. Flags author-concentration
 * risk.
 */
export function auditRotationLedger(
  ledger: RotationLedger,
  now: Date = new Date(),
  requirement: MonthlyRotationRequirement = DEFAULT_REQUIREMENT,
): RotationGuardReport {
  const windowMs = requirement.max_author_share_window_days * 86_400_000;
  const windowStart = new Date(now.getTime() - windowMs);
  const recent = ledger.entries.filter(e => new Date(e.added_at) >= windowStart);

  const counts = new Map<string, number>();
  for (const e of recent) counts.set(e.author_id, (counts.get(e.author_id) ?? 0) + 1);

  const total = recent.length;
  const max = Math.max(0, ...counts.values());
  const maxShare = total === 0 ? 0 : max / total;
  return {
    window_start: windowStart.toISOString(),
    window_end: now.toISOString(),
    total_scenarios_added: total,
    unique_authors: counts.size,
    max_share_by_author: maxShare,
    diverse_enough: maxShare <= requirement.max_author_share_threshold,
  };
}

/**
 * Convert validated drafts into ledger entries. Caller is expected to
 * write the JSON files + regenerate the manifest separately (so the
 * signing step stays explicit and auditable).
 */
export function buildLedgerEntries(
  drafts: readonly RedTeamScenarioDraft[],
  prefix: string,
  manifestHashAfter: string,
  now: Date = new Date(),
): RotationLedgerEntry[] {
  return drafts.map((d, idx) => ({
    scenario_id: `${prefix}-${String(idx + 1).padStart(3, '0')}`,
    author_id: d.author_id,
    added_at: now.toISOString(),
    manifest_hash_after: manifestHashAfter,
  }));
}
