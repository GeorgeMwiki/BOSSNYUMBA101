/**
 * Rollback — reverse-apply a (partially) committed bootstrap.
 *
 * Research §13.2 (rollback primitives). Each step has an inverse:
 *   create_tenant         ↔ archive_tenant
 *   create_property       ↔ remove_property
 *   create_unit           ↔ remove_unit
 *   invite_team_member    ↔ cancel_team_invitation
 *   seed_rules            ↔ clear_rules
 *   wire_connector        ↔ disconnect_connector
 *
 * Reverse order is critical — unwind units before their property,
 * properties before the tenant, etc. Writers must implement the
 * inverse operations; we just sequence them.
 */

import type {
  BootstrapStep,
  BootstrapStepKind,
} from './idempotent-writer.js';

export interface RollbackWriter {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  reverse(step: BootstrapStep): Promise<{ reversed: boolean; reason?: string }>;
}

export interface RollbackResult {
  readonly ok: boolean;
  readonly reversed: number;
  readonly notReversed: readonly { step: BootstrapStep; reason: string }[];
  readonly error?: string;
}

const INVERSE: Record<BootstrapStepKind, string> = {
  create_tenant: 'archive_tenant',
  create_property: 'remove_property',
  create_unit: 'remove_unit',
  invite_team_member: 'cancel_team_invitation',
  seed_rules: 'clear_rules',
  wire_connector: 'disconnect_connector',
};

export function inverseOf(kind: BootstrapStepKind): string {
  return INVERSE[kind];
}

/**
 * Reverse-apply the committed steps in reverse order. The writer
 * decides whether a particular step is reversible (e.g. WhatsApp
 * sends are not — research §13.2). Non-reversible steps are reported
 * but do not fail the rollback.
 */
export async function runRollback(
  committedSteps: readonly BootstrapStep[],
  writer: RollbackWriter,
): Promise<RollbackResult> {
  const reverseOrder = [...committedSteps].reverse();
  const notReversed: { step: BootstrapStep; reason: string }[] = [];
  let reversed = 0;

  await writer.beginTransaction();
  try {
    for (const step of reverseOrder) {
      const r = await writer.reverse(step);
      if (r.reversed) {
        reversed++;
      } else {
        notReversed.push({ step, reason: r.reason ?? 'not reversible' });
      }
    }
    await writer.commit();
    return { ok: true, reversed, notReversed };
  } catch (error) {
    await writer.rollback();
    return {
      ok: false,
      reversed: 0,
      notReversed,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test double for the writer — always reverses, never throws.
 */
export class RecordingRollbackWriter implements RollbackWriter {
  public readonly reversed: BootstrapStep[] = [];
  private inTx = false;
  constructor(private readonly nonReversibleKinds: ReadonlySet<BootstrapStepKind> = new Set()) {}

  async beginTransaction(): Promise<void> {
    this.inTx = true;
  }
  async commit(): Promise<void> {
    this.inTx = false;
  }
  async rollback(): Promise<void> {
    this.inTx = false;
    this.reversed.length = 0;
  }
  async reverse(step: BootstrapStep): Promise<{ reversed: boolean; reason?: string }> {
    if (!this.inTx) throw new Error('reverse outside transaction');
    if (this.nonReversibleKinds.has(step.kind)) {
      return { reversed: false, reason: `${step.kind} is not reversible` };
    }
    this.reversed.push(step);
    return { reversed: true };
  }
}
