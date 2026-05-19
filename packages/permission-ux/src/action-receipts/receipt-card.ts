/**
 * receipt-card — Zod schema for the ag-ui `ReceiptCard` kind.
 *
 * Mirrors the wire shape consumed by @bossnyumba/genui's renderer.
 * The new kind is added to `packages/genui/src/schemas/index.ts` so
 * the chat workspace can render it as a typed card.
 */

import { z } from 'zod';

const Iso8601 = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), 'must be ISO-8601 parseable');

export const ReceiptCardAffectedEntitySchema = z
  .object({
    entityType: z.string().min(1).max(120),
    entityId: z.string().min(1).max(200),
    label: z.string().max(200).optional(),
  })
  .strict();

export const ReceiptCardArgsSummarySchema = z
  .object({
    headline: z.string().min(1).max(200),
    fields: z
      .record(z.union([z.string().max(500), z.number(), z.boolean()]))
      .optional(),
  })
  .strict();

export const ReceiptCardPartSchema = z
  .object({
    kind: z.literal('receipt-card'),
    title: z.string().max(200).optional(),
    receiptId: z.string().min(1).max(200),
    actionId: z.string().min(1).max(200),
    toolName: z.string().min(1).max(200),
    tier: z.enum(['read', 'mutate', 'destroy', 'billing', 'external-comm']),
    tenantId: z.string().min(1).max(200),
    executedBy: z.string().min(1).max(200),
    executedAt: Iso8601,
    status: z.enum(['applied', 'rolled-back']),
    argsSummary: ReceiptCardArgsSummarySchema,
    affectedEntities: z.array(ReceiptCardAffectedEntitySchema).max(500),
    references: z.array(z.string().min(1).max(2000)).max(50),
    rollbackEnabled: z.boolean(),
    rollbackWindowMinutes: z.number().int().min(0).max(60_000),
    rollbackExpiresAt: Iso8601.optional(),
    rolledBackAt: Iso8601.optional(),
    rolledBackBy: z.string().max(200).optional(),
  })
  .strict();

export type ReceiptCardPart = z.infer<typeof ReceiptCardPartSchema>;
