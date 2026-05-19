/**
 * render — convert a `ReceiptEntity` into a wire-shape `ReceiptCardPart`
 * the J9 chat-workspace can render.
 *
 * Pure. No I/O.
 */

import type { ReceiptCardPart } from './receipt-card.js';
import type { ReceiptEntity } from './types.js';

export interface RenderReceiptCardOptions {
  /** Override title shown on the card. */
  readonly title?: string;
  /** Injectable clock — when set, used to compute rollbackExpiresAt. */
  readonly now?: () => Date;
}

export function renderReceiptCard(
  receipt: ReceiptEntity,
  opts: RenderReceiptCardOptions = {},
): ReceiptCardPart {
  const rollbackEnabled =
    receipt.rollbackWindowMinutes > 0 &&
    receipt.rollbackToken !== null &&
    receipt.status === 'applied';

  let rollbackExpiresAt: string | undefined;
  if (receipt.rollbackWindowMinutes > 0) {
    const executedMs = Date.parse(receipt.executedAt);
    if (!Number.isNaN(executedMs)) {
      rollbackExpiresAt = new Date(
        executedMs + receipt.rollbackWindowMinutes * 60_000,
      ).toISOString();
    }
  }

  const argsFields: Record<string, string | number | boolean> = {
    ...receipt.argsSummary.fields,
  };

  const part: ReceiptCardPart = {
    kind: 'receipt-card',
    receiptId: receipt.id,
    actionId: receipt.actionId,
    toolName: receipt.toolName,
    tier: receipt.tier,
    tenantId: receipt.tenantId,
    executedBy: receipt.executedBy,
    executedAt: receipt.executedAt,
    status: receipt.status,
    argsSummary: {
      headline: receipt.argsSummary.headline,
      fields: argsFields,
    },
    affectedEntities: receipt.affectedEntities.map((e) =>
      e.label !== undefined
        ? { entityType: e.entityType, entityId: e.entityId, label: e.label }
        : { entityType: e.entityType, entityId: e.entityId },
    ),
    references: [...receipt.references],
    rollbackEnabled,
    rollbackWindowMinutes: receipt.rollbackWindowMinutes,
  };

  if (opts.title !== undefined) {
    (part as { title?: string }).title = opts.title;
  }
  if (rollbackExpiresAt !== undefined) {
    (part as { rollbackExpiresAt?: string }).rollbackExpiresAt =
      rollbackExpiresAt;
  }
  if (receipt.rolledBackAt !== undefined) {
    (part as { rolledBackAt?: string }).rolledBackAt = receipt.rolledBackAt;
  }
  if (receipt.rolledBackBy !== undefined) {
    (part as { rolledBackBy?: string }).rolledBackBy = receipt.rolledBackBy;
  }
  return part;
}
