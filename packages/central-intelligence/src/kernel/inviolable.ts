/**
 * Inviolable refusal gates — hard refusals the kernel issues BEFORE
 * the sensor is ever called. These differ from the prompt-shield
 * (which sanitises) and the policy-gate (which redacts on output).
 * Inviolable rules are categorical: if the input matches, the kernel
 * returns a refusal decision.
 *
 * The rules are deterministic regex / structure checks — no LLM. They
 * cover four categories:
 *
 *   1. Cross-tenant identification — asking about a tenant in a
 *      scope that does not own that tenant.
 *   2. PII exfiltration — asking the agent to output IDs/numbers in
 *      bulk for export to an unknown sink.
 *   3. Counterfeit-authority — claims the user is "from BossNyumba"
 *      asking for system internals.
 *   4. Tribunal/legal autonomy — asking the agent to "decide" an
 *      eviction without going through the documented arrears ladder.
 */

import type { ScopeContext } from '../types.js';
import type { ThoughtRequest } from './kernel-types.js';

export interface InviolableVerdict {
  readonly status: 'pass' | 'block';
  readonly category?: 'cross-tenant' | 'pii-bulk' | 'authority' | 'autonomy';
  readonly reason?: string;
}

const BULK_PII_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(export|dump|list|give me|send me|email me)\b.{0,40}\b(all|every|each|complete)\b.{0,40}\b(tenant|resident|owner|phone|email|nida|tin|passport)/i,
  /\b(spreadsheet|csv|excel|xlsx)\b.{0,30}\b(of|with)\b.{0,30}\b(tenant|resident|owner|phone)/i,
];

const COUNTERFEIT_AUTHORITY_PATTERNS: ReadonlyArray<RegExp> = [
  /\bi am (from|with) (bossnyumba|boss[- ]?nyumba|the platform|hq)\b/i,
  /\b(override|bypass|disable) (your|the) (system prompt|safety|guard|gate|policy)/i,
  /\b(developer mode|admin mode|root mode|debug mode|sudo)\b/i,
];

const TRIBUNAL_AUTONOMY_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(decide|finalize|finalise|approve|sign[- ]off on)\b.{0,40}\b(eviction|termination|lockout|seizure)/i,
  /\b(skip|bypass)\b.{0,30}\b(arrears ladder|notice|tribunal|hearing)/i,
];

export function checkInviolable(req: ThoughtRequest): InviolableVerdict {
  const msg = req.userMessage;

  if (containsCrossTenantReference(msg, req.scope)) {
    return {
      status: 'block',
      category: 'cross-tenant',
      reason: 'request references a tenant outside the current scope',
    };
  }

  for (const re of BULK_PII_PATTERNS) {
    if (re.test(msg)) {
      return {
        status: 'block',
        category: 'pii-bulk',
        reason: 'bulk export of personal identifiers is not a kernel-served operation',
      };
    }
  }

  for (const re of COUNTERFEIT_AUTHORITY_PATTERNS) {
    if (re.test(msg)) {
      return {
        status: 'block',
        category: 'authority',
        reason: 'unverifiable authority claim or system-prompt override attempt',
      };
    }
  }

  for (const re of TRIBUNAL_AUTONOMY_PATTERNS) {
    if (re.test(msg)) {
      return {
        status: 'block',
        category: 'autonomy',
        reason: 'eviction / tribunal actions go through the arrears-ladder workflow, not the chat kernel',
      };
    }
  }

  return { status: 'pass' };
}

/**
 * Heuristic — flags `tenant_<uuid>` or `tenantId=` references inside
 * a platform scope, which by construction MUST be DP-aggregate only.
 * This is intentionally simple; the structured scope check on tools
 * is the real guarantee.
 */
function containsCrossTenantReference(msg: string, scope: ScopeContext): boolean {
  if (scope.kind !== 'platform') return false;
  return (
    /\btenant[_-]?id\s*[:=]/i.test(msg) ||
    /\btenant_[0-9a-f-]{8,}/i.test(msg) ||
    /\bbelonging to tenant\b/i.test(msg)
  );
}
