/**
 * Owner rent-payouts route — L8 settlement listing.
 *
 * Backs the `owner.rent_payout.list_mine` brain tool. Returns the
 * landlord's recent settlements (RFA-response -> ledger -> M-Pesa/
 * wallet/Stripe payout) for the cockpit pulse tile. Tenant-scoped
 * via JWT + RLS.
 */

import { Hono } from 'hono';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import {
  SettlementOrchestrator,
  resolveSettlementLedgerPort,
  resolveSettlementPayoutPort,
} from '../services/settlement/index.js';

const app = new Hono();
app.use('*', authMiddleware, databaseMiddleware);

app.get('/mine', async (c) => {
  const auth = c.get('auth') as { tenantId?: string } | undefined;
  const tenantId = auth?.tenantId;
  if (!tenantId) {
    return c.json(
      {
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'auth required' },
      },
      401,
    );
  }
  const limitStr = c.req.query('limit');
  const limit = Math.min(Math.max(Number(limitStr ?? 50) || 50, 1), 200);
  const db = c.get('db') as { execute(q: unknown): Promise<unknown> };
  const orchestrator = new SettlementOrchestrator({
    db,
    ledgerPort: resolveSettlementLedgerPort(),
    payoutPort: resolveSettlementPayoutPort(),
  });
  const payouts = await orchestrator.listForTenant({ tenantId, limit });
  return c.json({ success: true, data: { payouts } });
});

export const ownerRentPayoutsRouter = app;
export default ownerRentPayoutsRouter;
