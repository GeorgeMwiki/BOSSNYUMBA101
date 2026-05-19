/**
 * runSkillCuration — orchestrator for the K-C skill lifecycle pass.
 *
 * Reads all draft + promoted skills, evaluates each with the rules,
 * routes verdicts through M-F HITL for promotions, and applies the
 * resulting lifecycle update via SkillRegistryPort.
 */

import type {
  SkillCurationStats,
  SkillCurationVerdict,
  SkillLifecycle,
} from '../types.js';
import { evaluateSkill } from './curation-rules.js';

export interface SkillRecord {
  readonly skillId: string;
  readonly tenantId: string;
  readonly lifecycle: SkillLifecycle;
  readonly stats: SkillCurationStats;
}

/**
 * Port over the K-C Voyager skill registry.
 */
export interface SkillRegistryPort {
  listCurationCandidates(): Promise<ReadonlyArray<SkillRecord>>;
  setLifecycle(args: {
    skillId: string;
    lifecycle: SkillLifecycle;
    reason: string;
  }): Promise<void>;
}

/**
 * M-F skill-promotion-gate (hard HITL).
 */
export interface SkillPromotionGatePort {
  /**
   * Submit a promotion request. Returns true if M-F approved + applied,
   * false if request is queued/blocked.
   */
  requestPromotion(verdict: SkillCurationVerdict): Promise<boolean>;
}

export interface SkillCurationPorts {
  readonly registry: SkillRegistryPort;
  readonly gate: SkillPromotionGatePort;
  readonly clock: () => Date;
}

export interface SkillCurationResult {
  readonly evaluated: number;
  readonly promoted: number;
  readonly promotionsQueuedForHitl: number;
  readonly quarantined: number;
  readonly unchanged: number;
  readonly verdicts: ReadonlyArray<SkillCurationVerdict>;
}

/**
 * Public entrypoint.
 */
export async function runSkillCuration(
  ports: SkillCurationPorts,
): Promise<SkillCurationResult> {
  const skills = await ports.registry.listCurationCandidates();
  const verdicts: SkillCurationVerdict[] = [];
  let promoted = 0;
  let promotionsQueuedForHitl = 0;
  let quarantined = 0;
  let unchanged = 0;

  for (const skill of skills) {
    const verdict = evaluateSkill({
      skillId: skill.skillId,
      tenantId: skill.tenantId,
      currentLifecycle: skill.lifecycle,
      stats: skill.stats,
    });
    verdicts.push(verdict);

    if (verdict.proposedLifecycle === verdict.currentLifecycle) {
      unchanged += 1;
      continue;
    }

    if (verdict.proposedLifecycle === 'quarantined') {
      // Quarantine is automatic — no HITL gate.
      await ports.registry.setLifecycle({
        skillId: verdict.skillId,
        lifecycle: 'quarantined',
        reason: verdict.reason,
      });
      quarantined += 1;
      continue;
    }

    if (
      verdict.proposedLifecycle === 'promoted' &&
      verdict.gatedByHitl === true
    ) {
      const approved = await ports.gate.requestPromotion(verdict);
      if (approved) {
        await ports.registry.setLifecycle({
          skillId: verdict.skillId,
          lifecycle: 'promoted',
          reason: verdict.reason,
        });
        promoted += 1;
      } else {
        promotionsQueuedForHitl += 1;
      }
      continue;
    }
  }

  return Object.freeze({
    evaluated: skills.length,
    promoted,
    promotionsQueuedForHitl,
    quarantined,
    unchanged,
    verdicts: Object.freeze(verdicts),
  });
}
