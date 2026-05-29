/**
 * PT-RP — Owner rent-payout brain tool (L8 settlement listing).
 *
 * `owner.rent_payout.list_mine` returns the owner's recent settlement
 * payouts — the rent-collection cash that flowed through
 * LedgerService.post() and out via the M-Pesa / wallet / Stripe
 * payout port (services/api-gateway/src/services/settlement/).
 *
 * Separate file (vs. living inside owner-property-tools.ts) because:
 * (1) the spec calls for the canonical id `owner.rent_payout.list_mine`
 * verbatim; (2) it ships alongside the L8 orchestrator and is wired
 * via `GET /api/v1/owner/rent-payouts/mine`, distinct from the older
 * `owner.settlement.list_mine` listing.
 */

import { z } from 'zod';

import type { PersonaToolDescriptor } from './types.js';

const OWNER: ReadonlyArray<'T1_owner_strategist'> = ['T1_owner_strategist'];

const RentPayoutListMineInput = z.object({
  limit: z.number().int().positive().max(200).default(50),
});

const RentPayoutListMineOutput = z.object({
  payouts: z.array(
    z.object({
      id: z.string(),
      rfaId: z.string(),
      responseId: z.string(),
      status: z.string(),
      grossAmount: z.number(),
      depositAmount: z.number(),
      feeAmount: z.number(),
      netAmount: z.number(),
      currencyCode: z.string(),
      payoutProvider: z.string().nullable(),
      payoutProviderRef: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});

export const ownerRentPayoutListMineTool: PersonaToolDescriptor<
  typeof RentPayoutListMineInput,
  typeof RentPayoutListMineOutput
> = {
  id: 'owner.rent_payout.list_mine',
  name: 'Owner — my rent payouts (en) / Mwenye — malipo yangu (sw)',
  description:
    'List the owner\'s recent rent-payout settlements. Read-only — each ' +
    'row carries gross / deposit / fee / net + currency_code and the ' +
    'ledger txn id + payout provider ref so the cockpit can deep-link ' +
    'to the journal entry. Backed by the L8 SettlementOrchestrator.',
  personaSlugs: OWNER,
  inputSchema: RentPayoutListMineInput,
  outputSchema: RentPayoutListMineOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { payouts: [] };
    return client.get<{
      payouts: Array<{
        id: string;
        rfaId: string;
        responseId: string;
        status: string;
        grossAmount: number;
        depositAmount: number;
        feeAmount: number;
        netAmount: number;
        currencyCode: string;
        payoutProvider: string | null;
        payoutProviderRef: string | null;
        createdAt: string;
      }>;
    }>('/owner/rent-payouts/mine', {
      query: { limit: String(input.limit) },
    });
  },
};

export const RENT_PAYOUT_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  ownerRentPayoutListMineTool,
] as unknown as ReadonlyArray<PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>>);
