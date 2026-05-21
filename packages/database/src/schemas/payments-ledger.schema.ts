/**
 * Payments-Ledger Schema (Drizzle)
 *
 * Drizzle-backed schema for the payments-ledger service, replacing the
 * legacy Prisma schema previously kept at
 * `services/payments-ledger/prisma/schema.prisma`. Unifies the project
 * onto a single ORM (Drizzle), closing the A2 BLOCKER from
 * `.audit/deep-audit-2026-05-20.md` ("Dual ORMs in one DB").
 *
 * The actual `pgTable` definitions live in `ledger.schema.ts` — that
 * module already exposes the canonical Drizzle representations of every
 * Prisma model (paymentIntents, accounts, ledgerEntries, statements,
 * disbursements). This file re-exports them from a payments-ledger-
 * branded entry point so callers in `services/payments-ledger/**` can
 * say:
 *
 *   import {
 *     paymentIntents,
 *     accounts,
 *     ledgerEntries,
 *     statements,
 *     disbursements,
 *   } from '@bossnyumba/database';
 *
 * Mapping (Prisma model → Drizzle table):
 *
 *   PaymentIntent  → payment_intents (paymentIntents)
 *   Account        → accounts        (accounts)
 *   LedgerEntry    → ledger_entries  (ledgerEntries)
 *   Statement      → statements      (statements)
 *   Disbursement   → disbursements   (disbursements)
 *
 * Column-naming note: the Drizzle representation uses MINOR-UNITS-
 * explicit names (`amountMinorUnits`, `balanceMinorUnits`,
 * `balanceAfterMinorUnits`) where the Prisma representation used the
 * shorter `amount` / `balance` / `balance_after`. The DB column itself
 * stores integer minor units in both cases — see migration
 * `0167_payments_ledger_drizzle.sql` for the column-rename ALTERs that
 * align any pre-existing Prisma-managed table to the Drizzle layout.
 *
 * Tenant scoping + RLS: every table carries a `tenantId` (text NOT NULL)
 * referencing `tenants.id`. The RLS policies for payment_intents and
 * disbursements were installed by migration 0166; the remaining tables
 * inherit the same per-tenant isolation through the application layer
 * until a future RLS promote-out wave covers them.
 */

export {
  // ─── Enums ─────────────────────────────────────────────────────────────
  accountTypeEnum,
  accountStatusEnum,
  ledgerEntryTypeEnum,
  entryDirectionEnum,
  statementTypeEnum,
  statementStatusEnum,
  statementPeriodTypeEnum,
  disbursementStatusEnum,

  // ─── Tables ────────────────────────────────────────────────────────────
  accounts,
  ledgerEntries,
  statements,
  disbursements,
  paymentIntents,

  // ─── Relations ─────────────────────────────────────────────────────────
  accountsRelations,
  ledgerEntriesRelations,
  statementsRelations,
  disbursementsRelations,
  paymentIntentsRelations,
} from './ledger.schema.js';

// ───────────────────────────────────────────────────────────────────────
// Row-shape type aliases ($inferSelect / $inferInsert)
//
// Re-export the inferred row types under names that match the Prisma
// model names so existing payments-ledger code can switch from
// `import type { PaymentIntent as PrismaPaymentIntent } from '@prisma/client'`
// to
// `import type { PaymentIntentRow } from '@bossnyumba/database'`
// with the smallest possible diff.
// ───────────────────────────────────────────────────────────────────────

import {
  paymentIntents as _paymentIntents,
  accounts as _accounts,
  ledgerEntries as _ledgerEntries,
  statements as _statements,
  disbursements as _disbursements,
} from './ledger.schema.js';

export type PaymentIntentRow = typeof _paymentIntents.$inferSelect;
export type PaymentIntentInsert = typeof _paymentIntents.$inferInsert;

export type AccountRow = typeof _accounts.$inferSelect;
export type AccountInsert = typeof _accounts.$inferInsert;

export type LedgerEntryRow = typeof _ledgerEntries.$inferSelect;
export type LedgerEntryInsert = typeof _ledgerEntries.$inferInsert;

export type StatementRow = typeof _statements.$inferSelect;
export type StatementInsert = typeof _statements.$inferInsert;

export type DisbursementRow = typeof _disbursements.$inferSelect;
export type DisbursementInsert = typeof _disbursements.$inferInsert;
