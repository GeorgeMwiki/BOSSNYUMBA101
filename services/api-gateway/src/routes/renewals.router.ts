// @ts-nocheck
/**
 * Renewals Router
 *
 * REST endpoints over `RenewalService` (services/domain-services/src/lease):
 *   POST /renewals/:leaseId/window    - open renewal window
 *   POST /renewals/:leaseId/propose   - propose a new rent
 *   POST /renewals/:leaseId/accept    - accept proposal (creates new lease)
 *   POST /renewals/:leaseId/decline   - decline proposal
 *   POST /renewals/:leaseId/terminate - terminate outside renewal path
 *
 * The router is transport-thin — validation + service wiring only. The
 * actual service instance is expected on `c.get('renewalService')` via a
 * middleware in the gateway bootstrap.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';

const idParam = z.object({
  leaseId: z.string().min(1),
});

const ProposeSchema = z.object({
  proposedRent: z.number().int().positive(),
});

const AcceptSchema = z.object({
  newEndDate: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), 'invalid date'),
});

const DeclineSchema = z.object({
  reason: z.string().max(2000).optional(),
});

const TerminateSchema = z.object({
  terminationDate: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), 'invalid date'),
  reason: z.string().min(1).max(2000),
});

export const renewalsRouter = new Hono();

renewalsRouter.use('*', authMiddleware);

function correlationIdFrom(c): string {
  return c.req.header('x-correlation-id') ?? `corr_${Date.now()}`;
}

renewalsRouter.post(
  '/:leaseId/window',
  zValidator('param', idParam),
  async (c) => {
    const { leaseId } = c.req.valid('param');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const service = c.get('renewalService');
    const result = await service.openRenewalWindow(
      leaseId,
      tenantId,
      userId,
      correlationIdFrom(c),
    );
    return result.ok
      ? c.json({ success: true, data: result.value })
      : c.json({ success: false, error: result.error }, 400);
  },
);

renewalsRouter.post(
  '/:leaseId/propose',
  zValidator('param', idParam),
  zValidator('json', ProposeSchema),
  async (c) => {
    const { leaseId } = c.req.valid('param');
    const body = c.req.valid('json');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const service = c.get('renewalService');
    const result = await service.proposeRenewal(
      leaseId,
      tenantId,
      { proposedRent: body.proposedRent, proposedBy: userId },
      correlationIdFrom(c),
    );
    return result.ok
      ? c.json({ success: true, data: result.value })
      : c.json({ success: false, error: result.error }, 400);
  },
);

renewalsRouter.post(
  '/:leaseId/accept',
  zValidator('param', idParam),
  zValidator('json', AcceptSchema),
  async (c) => {
    const { leaseId } = c.req.valid('param');
    const body = c.req.valid('json');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const service = c.get('renewalService');
    const result = await service.acceptRenewal(
      leaseId,
      tenantId,
      { newEndDate: body.newEndDate, acceptedBy: userId },
      correlationIdFrom(c),
    );
    return result.ok
      ? c.json({ success: true, data: result.value })
      : c.json({ success: false, error: result.error }, 400);
  },
);

renewalsRouter.post(
  '/:leaseId/decline',
  zValidator('param', idParam),
  zValidator('json', DeclineSchema),
  async (c) => {
    const { leaseId } = c.req.valid('param');
    const body = c.req.valid('json');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const service = c.get('renewalService');
    const result = await service.declineRenewal(
      leaseId,
      tenantId,
      { declinedBy: userId, reason: body.reason },
      correlationIdFrom(c),
    );
    return result.ok
      ? c.json({ success: true, data: result.value })
      : c.json({ success: false, error: result.error }, 400);
  },
);

renewalsRouter.post(
  '/:leaseId/terminate',
  zValidator('param', idParam),
  zValidator('json', TerminateSchema),
  async (c) => {
    const { leaseId } = c.req.valid('param');
    const body = c.req.valid('json');
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const service = c.get('renewalService');
    const result = await service.terminate(
      leaseId,
      tenantId,
      {
        terminationDate: body.terminationDate,
        reason: body.reason,
        terminatedBy: userId,
      },
      correlationIdFrom(c),
    );
    return result.ok
      ? c.json({ success: true, data: result.value })
      : c.json({ success: false, error: result.error }, 400);
  },
);

export default renewalsRouter;
