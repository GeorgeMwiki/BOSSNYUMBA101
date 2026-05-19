/**
 * Specification self-critique.
 *
 * Lightweight, deterministic, pre-LLM gate (Roberts 2025 style). It
 * looks for known constitutional clauses (CLAUSE-id markers) in the
 * loaded constitution that forbid the proposed action class, and for
 * any forbidden-action markers embedded in the proposed action args.
 *
 * Then — if the gate passes — the brain runs the *LLM* self-critique
 * step. Both must agree before the destructive action proceeds.
 *
 * This deterministic gate guarantees a safe default even if the LLM
 * critique itself is compromised: the brain cannot dissolve a clause
 * that is plain-text matched here.
 */

import type {
  LoadedConstitution,
  ProposedAction,
  SelfCorrectionVerdict,
  SelfCritique,
} from './types.js';

const DESTRUCTIVE_TOOL_PATTERNS: ReadonlyArray<RegExp> = [
  /\bdrop[_-]?table\b/i,
  /\btruncate\b/i,
  /\bdelete[_-]?all\b/i,
  /\bbulk[_-]?delete\b/i,
  /\bmass[_-]?evict\b/i,
  /\bself[_-]?modify\b/i,
];

const CLAUSE_DENY_MARKERS: ReadonlyArray<{ readonly id: string; readonly pattern: RegExp; readonly recommendation: 'defer' | 'escalate' | 'refuse' }> = [
  { id: 'AUDIT-IMMUTABILITY', pattern: /audit[_ -]?log\s+is\s+(append-only|immutable)/i, recommendation: 'refuse' },
  { id: 'JURISDICTION-PORTABILITY', pattern: /no\s+hard[_ -]?coded\s+(jurisdiction|currency|locale)/i, recommendation: 'refuse' },
  { id: 'PAYMENT-CAP', pattern: /payments?\s+above\s+\$?\d+\s+(require|need)\s+four[_ -]?eye/i, recommendation: 'escalate' },
  { id: 'SELF-MODIFICATION', pattern: /(brain|agent)\s+(MUST\s+NOT|must\s+not)\s+modify\s+(its\s+own\s+)?autonomy[_ -]?caps/i, recommendation: 'refuse' },
  { id: 'CROSS-TENANT', pattern: /cross[_ -]?tenant\s+(reads|writes|access)\s+(require|need)\s+(opt[_ -]?in|approval)/i, recommendation: 'escalate' },
];

/**
 * Pure judgement function. Returns the verdict + clause id when
 * something looks off.
 */
export function critique(constitution: LoadedConstitution, action: ProposedAction): SelfCritique {
  const argsBlob = JSON.stringify(action.args);
  const haystack = `${action.tool} ${argsBlob}`.toLowerCase();

  const destructivePattern = DESTRUCTIVE_TOOL_PATTERNS.find(p => p.test(haystack));
  if (destructivePattern && !action.destructive) {
    return {
      action,
      constitution_version: constitution.version,
      constitution_sha256: constitution.sha256,
      verdict: {
        status: 'unsafe-to-proceed',
        reason: `tool/args matched destructive pattern ${destructivePattern} but destructive=false`,
      },
      evaluated_at: new Date().toISOString(),
    };
  }

  if (action.destructive) {
    for (const clause of CLAUSE_DENY_MARKERS) {
      if (!clause.pattern.test(constitution.content)) continue;
      // Active clause: is the action class implicated?
      if (
        (clause.id === 'AUDIT-IMMUTABILITY' && /audit/.test(haystack)) ||
        (clause.id === 'JURISDICTION-PORTABILITY' && /(jurisdiction|currency|locale)/.test(haystack)) ||
        (clause.id === 'PAYMENT-CAP' && /(payment|payout|transfer)/.test(haystack)) ||
        (clause.id === 'SELF-MODIFICATION' && /(autonomy[_ -]?cap|self[_ -]?modify)/.test(haystack)) ||
        (clause.id === 'CROSS-TENANT' && /cross[_ -]?tenant/.test(haystack))
      ) {
        const verdict: SelfCorrectionVerdict = {
          status: 'conflict',
          clause: clause.id,
          recommendation: clause.recommendation,
        };
        return { action, constitution_version: constitution.version, constitution_sha256: constitution.sha256, verdict, evaluated_at: new Date().toISOString() };
      }
    }
  }

  return {
    action,
    constitution_version: constitution.version,
    constitution_sha256: constitution.sha256,
    verdict: { status: 'aligned', evidence: `no_clause_conflict; constitution_sha=${constitution.sha256.slice(0, 12)}` },
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Outcome convenience: should the action proceed?
 */
export function shouldProceed(critique: SelfCritique): boolean {
  return critique.verdict.status === 'aligned';
}
