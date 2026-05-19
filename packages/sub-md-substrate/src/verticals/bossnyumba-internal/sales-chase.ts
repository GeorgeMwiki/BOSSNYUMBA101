/**
 * sales.chase — Chase<ChurnRiskOwner, EscalationRung>
 *
 * Walks an owner-account through an escalation ladder when a churn
 * signal fires. Compatible with `customer-success.compile`: the
 * compile step surfaces risky owners; sales.chase actually nudges
 * them.
 *
 * Ladder (default):
 *   0  product-tip email                cooldown 72h
 *   1  feature-walkthrough video email  cooldown 96h
 *   2  AM phone call                    cooldown 48h
 *   3  saver-offer email                cooldown 72h
 *   4  exec escalation (handoff)        cooldown 0
 */

import {
  createChase,
  type ChaseLadder,
  type ChaseLadderRung,
  type ChasePrimitive,
} from '../../primitives/chase.js';
import type { OwnerAccount } from './entities.js';

const DEFAULT_LADDER: ChaseLadder = Object.freeze({
  rungs: Object.freeze<ChaseLadderRung[]>([
    Object.freeze({
      index: 0,
      label: 'product-tip',
      channel: 'email',
      cooldownMs: 72 * 60 * 60 * 1000,
      draftHint: 'Two-paragraph product tip tied to their most-used feature.',
    }),
    Object.freeze({
      index: 1,
      label: 'feature-walkthrough',
      channel: 'email',
      cooldownMs: 96 * 60 * 60 * 1000,
      draftHint: 'Loom-style walkthrough of the under-used feature.',
    }),
    Object.freeze({
      index: 2,
      label: 'am-phone-call',
      channel: 'voice',
      cooldownMs: 48 * 60 * 60 * 1000,
      draftHint: 'Account manager phone script focused on listening.',
    }),
    Object.freeze({
      index: 3,
      label: 'saver-offer',
      channel: 'email',
      cooldownMs: 72 * 60 * 60 * 1000,
      draftHint: 'Discount / extension offer tailored to tenure.',
    }),
    Object.freeze({
      index: 4,
      label: 'exec-escalation',
      channel: 'inbox',
      cooldownMs: 0,
    }),
  ]),
  handoffAtRung: 4,
});

export interface SalesChaseSubMd {
  readonly name: string;
  readonly chase: ChasePrimitive<OwnerAccount>;
}

export interface CreateSalesChaseArgs {
  readonly ladder?: ChaseLadder;
  /**
   * Returns true when the owner is no longer at risk (e.g. usage spike
   * after intervention). Stops the chase early.
   */
  readonly isOwnerRecovered?: (owner: OwnerAccount) => boolean;
}

export function createSalesChase(args: CreateSalesChaseArgs = {}): SalesChaseSubMd {
  return Object.freeze({
    name: 'sales.chase',
    chase: createChase<OwnerAccount>({
      name: 'sales.chase.next-touch',
      ladder: args.ladder ?? DEFAULT_LADDER,
      ...(args.isOwnerRecovered !== undefined
        ? { isTargetResolved: args.isOwnerRecovered }
        : {}),
    }),
  });
}

export { DEFAULT_LADDER as DEFAULT_SALES_CHASE_LADDER };
