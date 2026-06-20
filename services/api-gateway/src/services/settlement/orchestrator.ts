/**
 * Settlement orchestrator — real-estate chain L8.
 *
 * Drives the end-to-end "landlord signs move-in → ledger journal →
 * landlord payout" loop. The orchestrator is the SOLE money-mutating
 * path for RFA settlements; the CLAUDE.md hard rule "Money MUST go
 * through LedgerService.post()" is satisfied by the settlement ledger
 * port (production composition wraps the real LedgerService.post()).
 *
 * Flow per signMoveIn():
 *   1. Cross-tenant idempotency check on (tenant, response, checksum).
 *      Replays return the existing row with `idempotent: true`.
 *   2. Load the response + parent RFA inside the LANDLORD's RLS scope.
 *   3. Compute gross / deposit / fee / net.
 *   4. INSERT settlements row with status='pending'.
 *   5. LedgerService.post() via the port. Stamp ledger_txn_id +
 *      status='posted'. A failure here marks the row 'failed' and
 *      throws — no payout fires.
 *   6. Payout via the port (M-Pesa B2C / wallet / Stripe). Stamp
 *      provider + provider_ref + status='paying_out'. Best-effort:
 *      payout failure stays 'posted' so a retry can pick it up.
 *   7. Emit a cockpit `rent_payout.initiated` event so the owner sees
 *      the live settlement landing.
 */

import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { createLogger } from '../../utils/logger.js';
import { publishCockpitEvent } from '../cockpit-events/index.js';
import {
  computeSettlementMath,
  type SettlementLedgerPort,
  type SettlementPayoutPort,
  type SettlementMath,
  type SignMoveInInput,
  type SignMoveInResult,
  type SignRfbDeliveryInput,
  type SettlementStatus,
  type PayoutProvider,
} from './types.js';

const moduleLogger = createLogger('settlement-orchestrator');

interface DbExecutor {
  execute(query: unknown): Promise<unknown>;
}

function rowsOf(raw: unknown): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as ReadonlyArray<Record<string, unknown>>;
  if (raw && typeof raw === 'object' && 'rows' in raw) {
    const r = (raw as { rows: unknown }).rows;
    if (Array.isArray(r)) return r as ReadonlyArray<Record<string, unknown>>;
  }
  return [];
}

export interface SettlementOrchestratorDeps {
  readonly db: DbExecutor;
  readonly ledgerPort: SettlementLedgerPort;
  readonly payoutPort: SettlementPayoutPort;
}

export class SettlementOrchestrator {
  private readonly db: DbExecutor;
  private readonly ledgerPort: SettlementLedgerPort;
  private readonly payoutPort: SettlementPayoutPort;

  constructor(deps: SettlementOrchestratorDeps) {
    this.db = deps.db;
    this.ledgerPort = deps.ledgerPort;
    this.payoutPort = deps.payoutPort;
  }

  async signMoveIn(input: SignMoveInInput): Promise<SignMoveInResult> {
    const { tenantId, landlordUserId, responseId, moveInChecksum } = input;

    // ---- step 1: idempotency lookup -----------------------------------
    const existing = this.findExistingSettlement(
      await this.db.execute(sql`
        SELECT id::text AS id,
               status,
               gross_amount::text AS gross_amount,
               deposit_amount::text AS deposit_amount,
               fee_amount::text AS fee_amount,
               net_amount::text AS net_amount,
               currency_code,
               ledger_txn_id,
               payout_provider,
               payout_provider_ref
          FROM settlements
         WHERE tenant_id = ${tenantId}::uuid
           AND response_id = ${responseId}::uuid
           AND idempotency_key = ${moveInChecksum}
         LIMIT 1
      `),
    );
    if (existing) return existing;

    // ---- step 2: load response + parent RFA --------------------------
    // The RFA pipeline in BossNyumba uses `applications` (analogue of
    // request_for_bid_responses) joined with `leases` (analogue of
    // request_for_bids). The `landlord_user_id` on the lease is the
    // counterparty owner the payout pays.
    const respRows = rowsOf(
      await this.db.execute(sql`
        SELECT
          a.id::text                        AS response_id,
          a.lease_id::text                  AS lease_id,
          a.tenant_id::text                 AS tenant_id,
          a.applicant_user_id               AS applicant_user_id,
          a.deposit_amount::text            AS deposit_amount,
          l.rent_amount::text               AS rent_amount,
          l.lease_term_months               AS lease_term_months,
          l.currency_code                   AS currency_code,
          l.landlord_user_id                AS landlord_user_id,
          l.unit_id::text                   AS unit_id
          FROM applications a
          JOIN leases l ON l.id = a.lease_id
         WHERE a.id = ${responseId}::uuid
         LIMIT 1
      `),
    )[0];

    if (!respRows) {
      throw new SettlementError(
        'RESPONSE_NOT_FOUND',
        `Response ${responseId} not found in tenant ${tenantId}`,
      );
    }
    if (String(respRows.tenant_id) !== tenantId) {
      // Cross-tenant attempt — refuse loudly.
      throw new SettlementError(
        'CROSS_TENANT_BLOCKED',
        `Response ${responseId} belongs to a different tenant`,
      );
    }
    if (String(respRows.landlord_user_id ?? '') !== landlordUserId) {
      throw new SettlementError(
        'UNAUTHORIZED_LANDLORD',
        `User ${landlordUserId} is not the landlord for lease ${respRows.lease_id}`,
      );
    }

    // ---- step 3: compute math ----------------------------------------
    const math = computeSettlementMath({
      rentAmount: Number(respRows.rent_amount ?? 0),
      leaseTermMonths: Number(respRows.lease_term_months ?? 0),
      depositAmount: Number(respRows.deposit_amount ?? 0),
      currencyCode: String(respRows.currency_code ?? 'TZS'),
    });

    // ---- steps 4-7: INSERT → ledger.post → payout → cockpit ----------
    return this.executeSettlement({
      tenantId,
      rfaId: String(respRows.lease_id),
      responseId,
      landlordUserId: String(respRows.landlord_user_id ?? ''),
      idempotencyKey: moveInChecksum,
      initiatedBy: landlordUserId,
      math,
    });
  }

  /**
   * Applicant-driven RFB sign-delivery (lease activation) — the tenant-mobile
   * counterparty L8 path. The APPLICANT who owns the parent rfb_requests row
   * signs; the settlement pays the landlord who posted the ACCEPTED
   * `rfb_responses` row. Shares the single money path (executeSettlement →
   * ledgerPort.post → payoutPort.payout) with signMoveIn.
   */
  async signRfbDelivery(input: SignRfbDeliveryInput): Promise<SignMoveInResult> {
    const { tenantId, applicantUserId, responseId, coCStepChecksum } = input;

    // ---- step 1: idempotency lookup -----------------------------------
    const existing = this.findExistingSettlement(
      await this.db.execute(sql`
        SELECT id::text AS id,
               status,
               gross_amount::text AS gross_amount,
               deposit_amount::text AS deposit_amount,
               fee_amount::text AS fee_amount,
               net_amount::text AS net_amount,
               currency_code,
               ledger_txn_id,
               payout_provider,
               payout_provider_ref
          FROM settlements
         WHERE tenant_id = ${tenantId}::uuid
           AND response_id = ${responseId}::uuid
           AND idempotency_key = ${coCStepChecksum}
         LIMIT 1
      `),
    );
    if (existing) return existing;

    // ---- step 2: load the ACCEPTED rfb_response + its parent request --
    // The applicant signing MUST own the parent rfb_requests row; the payout
    // pays the responding landlord. Both predicates are checked so a renter
    // cannot settle another renter's (or a non-accepted) response.
    const respRows = rowsOf(
      await this.db.execute(sql`
        SELECT
          r.id::text                AS response_id,
          r.tenant_id               AS tenant_id,
          r.rfb_id::text            AS rfb_id,
          r.landlord_user_id        AS landlord_user_id,
          r.rent_amount::text       AS rent_amount,
          r.lease_term_months       AS lease_term_months,
          r.deposit_amount::text    AS deposit_amount,
          r.currency_code           AS currency_code,
          r.status                  AS response_status,
          req.applicant_user_id     AS applicant_user_id
          FROM rfb_responses r
          JOIN rfb_requests req ON req.id = r.rfb_id
         WHERE r.id = ${responseId}::uuid
         LIMIT 1
      `),
    )[0];

    if (!respRows) {
      throw new SettlementError(
        'RESPONSE_NOT_FOUND',
        `RFB response ${responseId} not found in tenant ${tenantId}`,
      );
    }
    if (String(respRows.tenant_id) !== tenantId) {
      throw new SettlementError(
        'CROSS_TENANT_BLOCKED',
        `RFB response ${responseId} belongs to a different tenant`,
      );
    }
    if (String(respRows.response_status ?? '') !== 'accepted') {
      throw new SettlementError(
        'RESPONSE_NOT_ACCEPTED',
        `RFB response ${responseId} is not accepted (status=${respRows.response_status})`,
      );
    }
    if (String(respRows.applicant_user_id ?? '') !== applicantUserId) {
      throw new SettlementError(
        'UNAUTHORIZED_APPLICANT',
        `User ${applicantUserId} does not own the request behind response ${responseId}`,
      );
    }

    // ---- step 3: compute math ----------------------------------------
    const math = computeSettlementMath({
      rentAmount: Number(respRows.rent_amount ?? 0),
      leaseTermMonths: Number(respRows.lease_term_months ?? 0),
      depositAmount: Number(respRows.deposit_amount ?? 0),
      currencyCode: String(respRows.currency_code ?? 'TZS'),
    });

    // ---- steps 4-7: shared money path --------------------------------
    return this.executeSettlement({
      tenantId,
      rfaId: String(respRows.rfb_id),
      responseId,
      landlordUserId: String(respRows.landlord_user_id ?? ''),
      idempotencyKey: coCStepChecksum,
      initiatedBy: applicantUserId,
      math,
    });
  }

  /**
   * Project an idempotency-lookup row set into a SignMoveInResult, or null when
   * no prior settlement matches. Shared by signMoveIn + signRfbDelivery.
   */
  private findExistingSettlement(raw: unknown): SignMoveInResult | null {
    const existing = rowsOf(raw)[0];
    if (!existing) return null;
    const math: SettlementMath = {
      grossAmount: Number(existing.gross_amount ?? 0),
      depositAmount: Number(existing.deposit_amount ?? 0),
      feeAmount: Number(existing.fee_amount ?? 0),
      netAmount: Number(existing.net_amount ?? 0),
      currencyCode: String(existing.currency_code ?? 'TZS'),
    };
    return {
      settlementId: String(existing.id),
      status: (existing.status ?? 'pending') as SettlementStatus,
      math,
      ledgerTxnId: (existing.ledger_txn_id as string | null) ?? null,
      payoutProvider: (existing.payout_provider as PayoutProvider | null) ?? null,
      payoutProviderRef: (existing.payout_provider_ref as string | null) ?? null,
      idempotent: true,
    };
  }

  /**
   * Steps 4-7 of the settlement chain, shared by signMoveIn + signRfbDelivery:
   *   4. INSERT settlements row (status='pending').
   *   5. LedgerService.post() via the ledger port (the SOLE money-mutating
   *      seam — CLAUDE.md hard rule). Ledger failure marks 'failed' + throws;
   *      no payout fires.
   *   6. Payout via the payout port (best-effort; payout failure stays
   *      'posted' for the retry sweep).
   *   7. Cockpit `rent_payout.initiated` event.
   */
  private async executeSettlement(ctx: {
    readonly tenantId: string;
    readonly rfaId: string;
    readonly responseId: string;
    readonly landlordUserId: string;
    readonly idempotencyKey: string;
    readonly initiatedBy: string;
    readonly math: SettlementMath;
  }): Promise<SignMoveInResult> {
    const { tenantId, rfaId, responseId, landlordUserId, idempotencyKey, initiatedBy, math } =
      ctx;

    // ---- step 4: INSERT settlements row ------------------------------
    const settlementId = randomUUID();
    await this.db.execute(sql`
      INSERT INTO settlements (
        id, tenant_id, rfa_id, response_id,
        gross_amount, deposit_amount, fee_amount, net_amount,
        currency_code,
        status, idempotency_key, created_at
      ) VALUES (
        ${settlementId}::uuid,
        ${tenantId}::uuid,
        ${rfaId}::uuid,
        ${responseId}::uuid,
        ${math.grossAmount}, ${math.depositAmount},
        ${math.feeAmount}, ${math.netAmount},
        ${math.currencyCode},
        'pending',
        ${idempotencyKey},
        NOW()
      )
    `);

    // ---- step 5: LedgerService.post() via port -----------------------
    let ledgerTxnId: string;
    try {
      const ledgerRes = await this.ledgerPort.post({
        tenantId,
        responseId,
        idempotencyKey,
        math,
      });
      ledgerTxnId = ledgerRes.journalId;
      await this.db.execute(sql`
        UPDATE settlements
           SET status = 'posted', ledger_txn_id = ${ledgerTxnId}
         WHERE id = ${settlementId}::uuid
      `);
    } catch (err) {
      moduleLogger.error('settlement_ledger_post_failed', {
        err: err instanceof Error ? err.message : String(err),
        tenantId,
        settlementId,
        responseId,
      });
      await this.db.execute(sql`
        UPDATE settlements
           SET status = 'failed'
         WHERE id = ${settlementId}::uuid
      `);
      throw new SettlementError(
        'LEDGER_POST_FAILED',
        err instanceof Error ? err.message : 'ledger.post threw',
      );
    }

    // ---- step 6: payout via port (best-effort) -----------------------
    let payoutProvider: PayoutProvider | null = null;
    let payoutProviderRef: string | null = null;
    let finalStatus: SettlementStatus = 'posted';
    try {
      const payoutRes = await this.payoutPort.payout({
        tenantId,
        settlementId,
        netAmount: math.netAmount,
        currencyCode: math.currencyCode,
        landlordUserId,
      });
      payoutProvider = payoutRes.provider;
      payoutProviderRef = payoutRes.providerRef;
      finalStatus = 'paying_out';
      await this.db.execute(sql`
        UPDATE settlements
           SET status = 'paying_out',
               payout_provider = ${payoutProvider},
               payout_provider_ref = ${payoutProviderRef}
         WHERE id = ${settlementId}::uuid
      `);
    } catch (err) {
      moduleLogger.warn('settlement_payout_failed_will_retry', {
        err: err instanceof Error ? err.message : String(err),
        tenantId,
        settlementId,
      });
      // Status stays 'posted'; background payout retry picks it up.
    }

    // ---- step 7: cockpit event ---------------------------------------
    try {
      publishCockpitEvent({
        kind: 'rent_payout.initiated',
        tenantId,
        emittedAt: new Date().toISOString(),
        payoutId: settlementId,
        ownerId: landlordUserId,
        amount: math.netAmount,
        currencyCode: math.currencyCode,
        initiatedBy,
      });
    } catch (err) {
      moduleLogger.warn('settlement_cockpit_event_failed', {
        err: err instanceof Error ? err.message : String(err),
        tenantId,
        settlementId,
      });
    }

    moduleLogger.info('settlement_initiated', {
      settlementId,
      tenantId,
      responseId,
      rfaId,
      math,
      ledgerTxnId,
      payoutProvider,
      finalStatus,
    });

    return {
      settlementId,
      status: finalStatus,
      math,
      ledgerTxnId,
      payoutProvider,
      payoutProviderRef,
      idempotent: false,
    };
  }

  /**
   * List the landlord-side settlements for the current tenant. Used by
   * the owner cockpit and the `owner.rent_payout.list_mine` brain tool.
   */
  async listForTenant(input: {
    readonly tenantId: string;
    readonly limit?: number;
  }): Promise<
    ReadonlyArray<{
      readonly id: string;
      readonly rfaId: string;
      readonly responseId: string;
      readonly status: SettlementStatus;
      readonly grossAmount: number;
      readonly depositAmount: number;
      readonly feeAmount: number;
      readonly netAmount: number;
      readonly currencyCode: string;
      readonly payoutProvider: PayoutProvider | null;
      readonly payoutProviderRef: string | null;
      readonly createdAt: string;
    }>
  > {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const rows = rowsOf(
      await this.db.execute(sql`
        SELECT id::text AS id,
               rfa_id::text AS rfa_id,
               response_id::text AS response_id,
               status,
               gross_amount::text AS gross_amount,
               deposit_amount::text AS deposit_amount,
               fee_amount::text AS fee_amount,
               net_amount::text AS net_amount,
               currency_code,
               payout_provider,
               payout_provider_ref,
               created_at
          FROM settlements
         WHERE tenant_id = ${input.tenantId}::uuid
         ORDER BY created_at DESC
         LIMIT ${limit}
      `),
    );
    return rows.map((r) => ({
      id: String(r.id),
      rfaId: String(r.rfa_id),
      responseId: String(r.response_id),
      status: (r.status ?? 'pending') as SettlementStatus,
      grossAmount: Number(r.gross_amount ?? 0),
      depositAmount: Number(r.deposit_amount ?? 0),
      feeAmount: Number(r.fee_amount ?? 0),
      netAmount: Number(r.net_amount ?? 0),
      currencyCode: String(r.currency_code ?? 'TZS'),
      payoutProvider: (r.payout_provider as PayoutProvider | null) ?? null,
      payoutProviderRef: (r.payout_provider_ref as string | null) ?? null,
      createdAt: String(r.created_at ?? ''),
    }));
  }
}

export class SettlementError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'SettlementError';
  }
}
