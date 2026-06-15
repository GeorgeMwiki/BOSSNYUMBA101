
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDatabaseClient } from '../middleware/database';
import { authMiddleware } from '../middleware/hono-auth';
import { generateToken } from '../middleware/auth';
import { tokenBlocklist } from '../middleware/token-blocklist';
import { tenants, users, roles, userRoles, withServiceRoleContext } from '@bossnyumba/database';
import { UserRole } from '../types/user-role';
import {
  resolveInviteByToken,
  classifyInvite,
  acceptInvite,
  type InviteRejection,
} from './invite-accept-repo';

import { withSecurityEvents } from '@bossnyumba/observability';
// Request schemas — enforced server-side so clients cannot bypass.
const LoginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

// Co-owner invite acceptance. The invitee is anonymous (no JWT yet) — the
// email is taken IMMUTABLY from the token-resolved invite, never from client
// input, so the accept can never be redirected to a different identity.
const AcceptInviteSchema = z.object({
  token: z.string().min(16).max(512),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(200),
});

// Map a repo-layer rejection reason to a stable error envelope the FE keys on.
// `INVITE_EXPIRED` is the code the owner-portal InvitePage matches to show its
// dedicated "expired" screen (apps/owner-portal/src/pages/InvitePage.tsx:46).
const INVITE_REJECTION_ENVELOPE: Record<
  InviteRejection,
  { status: 410 | 404; code: string; message: string }
> = {
  expired: {
    status: 410,
    code: 'INVITE_EXPIRED',
    message: 'This invitation has expired. Ask the sender for a new one.',
  },
  revoked: {
    status: 410,
    code: 'INVITE_REVOKED',
    message: 'This invitation has been revoked and can no longer be used.',
  },
  accepted: {
    status: 410,
    code: 'INVITE_ALREADY_ACCEPTED',
    message: 'This invitation has already been accepted. Please sign in.',
  },
  not_found: {
    status: 404,
    code: 'INVITE_NOT_FOUND',
    message: 'This invitation link is invalid or has already been used.',
  },
};

const app = new Hono();

function mapRoleName(roleName?: string): UserRole {
  switch ((roleName || '').toLowerCase()) {
    case 'super_admin':
    case 'super-admin':
      return UserRole.SUPER_ADMIN;
    case 'support':
      return UserRole.SUPPORT;
    case 'owner':
      return UserRole.OWNER;
    case 'accountant':
      return UserRole.ACCOUNTANT;
    case 'property_manager':
    case 'property-manager':
    case 'manager':
      return UserRole.PROPERTY_MANAGER;
    case 'maintenance':
    case 'maintenance_staff':
      return UserRole.MAINTENANCE_STAFF;
    case 'resident':
      return UserRole.RESIDENT;
    case 'admin':
    case 'administrator':
      return UserRole.TENANT_ADMIN;
    case 'co_owner':
    case 'co-owner':
      // A co-owner has owner-level reach on the properties they share;
      // org-membership + RLS scope it to those properties only.
      return UserRole.OWNER;
    case 'viewer':
      // Read-only invitee — lowest privilege. (A precise read-only-owner
      // scope is a separate role-model task; here we fail SAFE on privilege.)
      return UserRole.RESIDENT;
    default:
      // Fail CLOSED on privilege: an UNRECOGNIZED role gets the LEAST
      // privilege, NEVER tenant-admin. A TENANT_ADMIN default silently
      // escalates every new role (e.g. a read-only co-owner invite) to full
      // tenant administration — a privilege-escalation vuln.
      return UserRole.RESIDENT;
  }
}

async function resolveAuthUser(email: string) {
  const db = getDatabaseClient();
  if (!db) return null;

  const rows = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      passwordHash: users.passwordHash,
      status: users.status,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      tenantStatus: tenants.status,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    // Case-insensitive email match. Callers normalize to lowercase
    // before calling this helper; the LOWER() on the column makes the
    // match resilient to historically-cased rows pre-dating the
    // normalization.
    .where(
      and(
        sql`LOWER(${users.email}) = LOWER(${email})`,
        isNull(users.deletedAt),
        isNull(tenants.deletedAt)
      )
    )
    .limit(1);

  const user = rows[0];
  if (!user) return null;

  const assignments = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.tenantId, user.tenantId)));

  const roleIds = assignments.map((row) => row.roleId);
  const roleRows = roleIds.length
    ? await db
        .select({
          id: roles.id,
          name: roles.name,
          permissions: roles.permissions,
          priority: roles.priority,
        })
        .from(roles)
        .where(and(eq(roles.tenantId, user.tenantId), inArray(roles.id, roleIds), isNull(roles.deletedAt)))
    : [];

  roleRows.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const primaryRole = roleRows[0]?.name;
  const permissions = Array.from(
    new Set(roleRows.flatMap((role) => (Array.isArray(role.permissions) ? role.permissions : [])))
  );

  return {
    ...user,
    role: mapRoleName(primaryRole),
    permissions: permissions.length ? permissions : ['*'],
    propertyAccess: ['*'],
  };
}

async function buildMePayload(auth: any) {
  const db = getDatabaseClient();
  if (!db) {
    return {
      user: {
        id: auth.userId,
        tenantId: auth.tenantId,
        role: auth.role,
        permissions: auth.permissions,
        propertyAccess: auth.propertyAccess,
      },
    };
  }

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarUrl: users.avatarUrl,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(and(eq(users.id, auth.userId), eq(users.tenantId, auth.tenantId), isNull(users.deletedAt)))
    .limit(1);

  const row = rows[0];
  return {
    user: row
      ? {
          id: row.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          avatarUrl: row.avatarUrl,
        }
      : {
          id: auth.userId,
          tenantId: auth.tenantId,
        },
    tenant: row
      ? {
          id: row.tenantId,
          name: row.tenantName,
          slug: row.tenantSlug,
        }
      : undefined,
    role: auth.role,
    permissions: auth.permissions,
    properties: auth.propertyAccess,
  };
}

app.post('/login', zValidator('json', LoginSchema), withSecurityEvents({ action: 'auth.create', resource: 'auth', severity: 'warn' }, async (c) => {
  const db = getDatabaseClient();
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Authentication requires a live database connection.',
        },
      },
      503
    );
  }

  const body = c.req.valid('json');
  // Normalize email to lowercase so User@Example.com and user@example.com
  // resolve to the same account. Without this, case variants enable
  // duplicate signups AND email enumeration via the case-sensitivity
  // channel.
  const normalizedEmail = body.email.trim().toLowerCase();
  const record = await resolveAuthUser(normalizedEmail);
  if (!record?.passwordHash) {
    return c.json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
  }

  // Block suspended/deactivated/pending accounts BEFORE password check so
  // attackers can't use the response-timing channel to infer status. The
  // status column is lowercased at storage time.
  const status = String(record.status ?? '').toLowerCase();
  if (status && status !== 'active') {
    return c.json(
      {
        success: false,
        error: {
          code: 'ACCOUNT_NOT_ACTIVE',
          message:
            status === 'suspended'
              ? 'Account suspended. Contact your administrator.'
              : status === 'deactivated'
                ? 'Account has been deactivated.'
                : 'Account is not yet active. Check your email for activation.',
        },
      },
      403
    );
  }

  // Same check for the tenant the user belongs to — a suspended tenant
  // means no one under it can log in (billing delinquency / compliance).
  const tenantStatus = String(record.tenantStatus ?? '').toLowerCase();
  if (tenantStatus && tenantStatus !== 'active' && tenantStatus !== 'trial') {
    return c.json(
      {
        success: false,
        error: {
          code: 'TENANT_NOT_ACTIVE',
          message: 'Organization account is not active. Please contact support.',
        },
      },
      403
    );
  }

  const valid = await bcrypt.compare(body.password, record.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } }, 401);
  }

  const token = generateToken({
    userId: record.id,
    tenantId: record.tenantId,
    role: record.role,
    permissions: record.permissions,
    propertyAccess: record.propertyAccess,
  });

  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: record.id,
        email: record.email,
        firstName: record.firstName,
        lastName: record.lastName,
        avatarUrl: record.avatarUrl,
      },
      tenant: {
        id: record.tenantId,
        name: record.tenantName,
        slug: record.tenantSlug,
      },
      role: record.role,
      permissions: record.permissions,
      properties: record.propertyAccess,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
}));

// ───────────────────────────────────────────────────────────────────────────
// Co-owner invite acceptance (owner-portal InvitePage). Both routes are PUBLIC
// — the invitee has no session yet. Token resolution is cross-tenant, so both
// run inside `withServiceRoleContext` (the 0335 co_owner_invites
// service-role-bypass policy lets the lookup/write through while the
// tenant-isolation policy would otherwise zero the rows — see invite-accept-repo).
// ───────────────────────────────────────────────────────────────────────────

// GET /auth/invite/:token — anonymous preview. Returns org name, role, inviter
// so the FE can render the "You've been invited" screen before the invitee
// commits a password. Rejects expired/revoked/already-accepted/unknown tokens
// with a stable typed envelope.
app.get('/invite/:token', async (c) => {
  const token = c.req.param('token');
  if (!token || token.length < 16) {
    return c.json(
      { success: false, error: INVITE_REJECTION_ENVELOPE.not_found },
      404,
    );
  }

  const db = getDatabaseClient();
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Invitations require a live database connection.',
        },
      },
      503,
    );
  }

  const invite = await withServiceRoleContext(db, (tx) =>
    resolveInviteByToken(tx as unknown as { execute(q: unknown): Promise<unknown> }, token),
  );

  if (!invite) {
    return c.json(
      { success: false, error: INVITE_REJECTION_ENVELOPE.not_found },
      404,
    );
  }

  const rejection = classifyInvite(invite);
  if (rejection) {
    const env = INVITE_REJECTION_ENVELOPE[rejection];
    return c.json({ success: false, error: env }, env.status);
  }

  return c.json({
    success: true,
    data: {
      inviteId: invite.id,
      email: invite.email,
      role: invite.role,
      inviterName: invite.inviterName,
      organizationName: invite.organizationName,
      propertyName: invite.properties.length
        ? invite.properties.join(', ')
        : undefined,
      expiresAt: invite.expiresAt,
    },
  });
});

// POST /auth/accept-invite — anonymous consume. Resolves the token, provisions
// the invitee (user + tenant role link, email pinned by the token), flips the
// invite to accepted. Idempotent: a double-submit (or already-accepted invite
// whose user exists) returns success without duplicating the account.
app.post(
  '/accept-invite',
  zValidator('json', AcceptInviteSchema),
  withSecurityEvents(
    { action: 'auth.create', resource: 'auth', severity: 'warn' },
    async (c) => {
      const body = c.req.valid('json');

      const db = getDatabaseClient();
      if (!db) {
        return c.json(
          {
            success: false,
            error: {
              code: 'AUTH_NOT_CONFIGURED',
              message: 'Invitations require a live database connection.',
            },
          },
          503,
        );
      }

      const passwordHash = await bcrypt.hash(body.password, 12);

      const outcome = await withServiceRoleContext(db, async (tx) => {
        const repoTx = tx as unknown as { execute(q: unknown): Promise<unknown> };
        const invite = await resolveInviteByToken(repoTx, body.token);
        if (!invite) {
          return { kind: 'reject' as const, reason: 'not_found' as InviteRejection };
        }

        const rejection = classifyInvite(invite);
        // An already-accepted invite is the idempotent-replay case (the FE
        // double-submitted, or the invitee revisited the link): re-run the
        // accept so the user/role link is guaranteed present, then report
        // success rather than the `accepted` rejection.
        if (rejection && rejection !== 'accepted') {
          return { kind: 'reject' as const, reason: rejection };
        }

        const result = await acceptInvite(repoTx, invite, {
          firstName: body.firstName,
          lastName: body.lastName,
          passwordHash,
        });
        return { kind: 'ok' as const, result };
      });

      if (outcome.kind === 'reject') {
        const env = INVITE_REJECTION_ENVELOPE[outcome.reason];
        return c.json({ success: false, error: env }, env.status);
      }

      return c.json({
        success: true,
        data: {
          accepted: true,
          email: outcome.result.email,
          role: outcome.result.role,
          organizationName: outcome.result.organizationName,
          // The FE routes the invitee to /login after success — no session
          // token is minted here (sign-in is an explicit, separate step).
        },
      });
    },
  ),
);

app.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth');
  return c.json({ success: true, data: await buildMePayload(auth) });
});

app.post('/refresh', authMiddleware, withSecurityEvents({ action: 'auth.create', resource: 'auth', severity: 'warn' }, async (c) => {
  const auth = c.get('auth');
  // Refresh-token rotation: the OLD token is added to the blocklist so
  // a compromised refresh cannot be replayed once the legitimate user
  // has rotated to a fresh token. Each refresh mints a new jti.
  if (auth.jti && auth.exp) {
    tokenBlocklist.revoke(auth.jti, auth.exp);
  }
  const token = generateToken({
    userId: auth.userId,
    tenantId: auth.tenantId,
    role: auth.role,
    permissions: auth.permissions,
    propertyAccess: auth.propertyAccess,
  });
  return c.json({
    success: true,
    data: {
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });
}));

app.post('/logout', authMiddleware, withSecurityEvents({ action: 'auth.create', resource: 'auth', severity: 'warn' }, async (c) => {
  const auth = c.get('auth');
  // Stateless JWTs can't self-invalidate; the blocklist is the
  // authoritative "this token is dead" signal for the remaining TTL.
  if (auth.jti && auth.exp) {
    tokenBlocklist.revoke(auth.jti, auth.exp);
  }
  return c.json({ success: true, data: { loggedOut: true } });
}));

app.post('/register', withSecurityEvents({ action: 'auth.create', resource: 'auth', severity: 'warn' }, (c) =>
  c.json({ success: false, error: { code: 'LIVE_DATA_NOT_IMPLEMENTED', message: 'Self-registration is not enabled.' } }, 503))
);
app.post('/change-password', withSecurityEvents({ action: 'auth.create', resource: 'auth', severity: 'warn' }, (c) =>
  c.json({ success: false, error: { code: 'LIVE_DATA_NOT_IMPLEMENTED', message: 'Password change is not enabled.' } }, 503))
);
app.post('/forgot-password', withSecurityEvents({ action: 'auth.create', resource: 'auth', severity: 'warn' }, (c) =>
  c.json({ success: false, error: { code: 'LIVE_DATA_NOT_IMPLEMENTED', message: 'Password reset is not enabled.' } }, 503))
);

export const authRouter = app;
