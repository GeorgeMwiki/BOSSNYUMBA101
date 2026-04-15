/**
 * Invitations scaffold routes.
 *
 * Co-owner / team invitation flows aren't fully wired yet. The scaffold
 * accepts the submission and echoes it back with an id so the owner
 * portal invite modal can show a success toast.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import { validationErrorHook } from './validators';

const app = new Hono();
app.use('*', authMiddleware);

const coOwnerInviteBodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200).optional(),
  propertyIds: z.array(z.string()).optional(),
  role: z.string().optional(),
  message: z.string().max(2000).optional(),
});

// TODO: wire to real store — persist invite + send email via notifications.
app.post(
  '/co-owner',
  zValidator('json', coOwnerInviteBodySchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');
    return c.json(
      {
        success: true,
        data: {
          id: `invite-${Date.now()}`,
          tenantId: auth.tenantId,
          invitedBy: auth.userId,
          email: body.email,
          name: body.name,
          propertyIds: body.propertyIds ?? [],
          role: body.role ?? 'co-owner',
          status: 'sent',
          createdAt: new Date().toISOString(),
        },
      },
      201
    );
  }
);

export const invitationsRouter = app;
