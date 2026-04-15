// @ts-nocheck
/**
 * Cross-tenant Memberships & Invitations
 *
 * POST /api/v1/memberships
 *   If the invitee has a user account in this tenant -> create an active
 *   membership row (201, membership).
 *   If no account exists -> create a pending invitation row keyed by email
 *   with a one-time invite token and send an email (welcome template).
 *   Returns 201 in both cases. The caller sees "invitation sent" via the
 *   { invitation: true } flag.
 *
 * On first successful login we auto-activate any pending memberships
 * tied to the signing-in user's email (see auth.ts :: activatePendingMemberships).
 */

import { Hono } from 'hono';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { memberships, users } from '@bossnyumba/database';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const INVITE_TOKEN_TTL_DAYS = 14;

/**
 * Attempts to send an invite email via the notifications service. The
 * notifications package is NOT a direct dependency of the api-gateway, so
 * we dynamic-import it and gracefully degrade on failure: the invitation
 * row still gets created and the caller receives a warning flag.
 */
async function sendInviteEmail(params: {
  email: string;
  inviterName?: string;
  tenantName?: string;
  inviteToken: string;
  locale?: string;
}): Promise<{ delivered: boolean; warning?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const notifications: any = await import(
      /* @vite-ignore */ '@bossnyumba/notifications'
    ).catch(() => null);

    if (!notifications) {
      return {
        delivered: false,
        warning: 'email delivery pending service wire-up',
      };
    }

    // Prefer welcome template if an invitation-specific one isn't available
    const getWelcome =
      notifications.getWelcomeTemplate ||
      notifications.welcomeTemplate ||
      notifications.getInvitationTemplate;

    const locale = (params.locale || 'en').toLowerCase().slice(0, 2);
    const rendered = getWelcome
      ? getWelcome(locale === 'sw' ? 'sw' : 'en', {
          name: params.inviterName,
          propertyName: params.tenantName,
        })
      : {
          subject: 'You have been invited to BOSSNYUMBA',
          body: `${params.inviterName || 'A team admin'} invited you to join ${
            params.tenantName || 'their workspace'
          } on BOSSNYUMBA. Use this token to accept: ${params.inviteToken}`,
        };

    const sender =
      notifications.sendEmail ||
      notifications.notificationService?.sendEmail ||
      notifications.enqueueNotification;

    if (!sender) {
      return {
        delivered: false,
        warning: 'email delivery pending service wire-up',
      };
    }

    await sender({
      to: params.email,
      subject: rendered.subject,
      body: rendered.body,
      template: 'invitation',
      data: {
        inviteToken: params.inviteToken,
        tenantName: params.tenantName,
      },
    });

    return { delivered: true };
  } catch (err) {
    logger.warn({ err }, 'Invitation email delivery failed');
    return {
      delivered: false,
      warning: 'email delivery pending service wire-up',
    };
  }
}

/**
 * Activate any pending memberships for the given email by attaching the
 * freshly-signed-up user id. Safe to call on every login - it's a no-op
 * when there are no pending rows.
 */
export async function activatePendingMemberships(
  db: any,
  userId: string,
  email: string
): Promise<number> {
  if (!db || !email) return 0;

  const normalized = email.trim().toLowerCase();
  const result = await db
    .update(memberships)
    .set({
      userId,
      status: 'active',
      activatedAt: new Date(),
      inviteToken: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(memberships.status, 'pending'),
        sql`LOWER(${memberships.inviteEmail}) = ${normalized}`
      )
    )
    .returning({ id: memberships.id });

  return Array.isArray(result) ? result.length : 0;
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

/**
 * POST /api/v1/memberships
 * Body: { email: string, role?: string, tenantId?: string }
 */
app.post('/', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const role =
    typeof body.role === 'string' && body.role.trim() ? body.role.trim() : 'member';
  const tenantId =
    typeof body.tenantId === 'string' && body.tenantId ? body.tenantId : auth.tenantId;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json(
      { success: false, error: { code: 'INVALID_EMAIL', message: 'Valid email required' } },
      400
    );
  }

  // Look up an existing user in this tenant by email
  const existing = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      language: users.language,
      locale: users.locale,
    })
    .from(users)
    .where(
      and(
        eq(users.tenantId, tenantId),
        sql`LOWER(${users.email}) = ${email.toLowerCase()}`,
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  const targetUser = existing[0];

  if (targetUser) {
    // Active membership: user already exists
    const id = crypto.randomUUID();
    const [row] = await db
      .insert(memberships)
      .values({
        id,
        tenantId,
        userId: targetUser.id,
        inviteEmail: email.toLowerCase(),
        role,
        status: 'active',
        invitedBy: auth.userId,
        activatedAt: new Date(),
        createdBy: auth.userId,
        updatedBy: auth.userId,
      })
      .returning();

    return c.json(
      {
        success: true,
        data: {
          membership: row,
          invitation: false,
          user: {
            id: targetUser.id,
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
          },
        },
      },
      201
    );
  }

  // User not found: create a pending invitation
  const inviteToken = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const id = crypto.randomUUID();

  const [row] = await db
    .insert(memberships)
    .values({
      id,
      tenantId,
      userId: null,
      inviteEmail: email.toLowerCase(),
      role,
      status: 'pending',
      inviteToken,
      inviteExpiresAt: expiresAt,
      invitedBy: auth.userId,
      createdBy: auth.userId,
      updatedBy: auth.userId,
    })
    .returning();

  // Fire off the email (non-blocking contract - failure still returns 201)
  const delivery = await sendInviteEmail({
    email,
    inviteToken,
    // best-effort context; we don't block on fetching tenant row
    tenantName: undefined,
    locale: 'en',
  });

  const payload: any = {
    success: true,
    data: {
      membership: row,
      invitation: true,
      inviteToken,
      expiresAt: expiresAt.toISOString(),
    },
  };

  if (!delivery.delivered) {
    payload.data.warning = delivery.warning || 'email delivery pending service wire-up';
  }

  return c.json(payload, 201);
});

/**
 * GET /api/v1/memberships  — list memberships for the caller's tenant
 */
app.get('/', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');

  const rows = await db
    .select()
    .from(memberships)
    .where(eq(memberships.tenantId, auth.tenantId));

  return c.json({ success: true, data: rows });
});

export const membershipsRouter = app;
