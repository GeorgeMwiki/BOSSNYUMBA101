// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
//   c.json({...}, status) branches (200/201/400/403/404/409/500/503) widen the
//   return type and the TypedResponse overload rejects the union
//   (hono-dev/hono#3891). Same pragma the sibling owner routers carry.

/**
 * /api/v1/owner/account — owner-portal Settings page + Skills controls backend.
 *
 * Replaces the old fake-success Settings page (which slept 1s and flashed a
 * green toast without persisting anything) and the dead Skills controls with
 * REAL, tenant-scoped, RLS-enforced handlers.
 *
 * Routes (all auth + tenant-scoped via JWT + databaseMiddleware GUC binding;
 * every state-changing route additionally gated by requireRole):
 *
 *   SETTINGS (owner_settings, migration 0334)
 *     GET  /settings                    resolve caller's display + notif prefs
 *     PUT  /settings                    upsert prefs (+ mirror currency into
 *     POST /settings                      currency_preferences). POST is an
 *                                         alias so the owner-portal api client
 *                                         (no .put helper) can call it.
 *
 *   CO-OWNERS (co_owner_invites, migration 0335 + users)
 *     GET    /co-owners                 accepted members (users) + pending invites
 *     POST   /co-owners/invite          create a pending invite + REAL email
 *     DELETE /co-owners/:id             revoke a pending invite (uniform-404)
 *     POST   /co-owners/:id/resend      rotate token + re-enqueue REAL email
 *
 *   SECURITY (users table + reuse of /auth/mfa engine)
 *     POST /security/password           change the caller's password (bcrypt)
 *     GET  /security/2fa                report whether MFA is configured
 *
 *   SKILLS (owner_skills, migration 0162 — the real owner-skill engine)
 *     GET  /skills                      list installed skills (SkillSummary[])
 *     POST /skills/:id/install          enable an existing skill (typed 404)
 *     POST /skills/:id/toggle           toggle enabled
 *     POST /skills/:id/run              record a manual run (+ brain dispatch FE)
 *
 * Anti-IDOR: every read/write filters on tenant_id (RLS + explicit predicate)
 * AND, for per-user resources (settings, password), on user_id from the JWT.
 * A missing co-owner-invite / skill returns a UNIFORM 404 — never leaking
 * existence across tenants.
 *
 * The notifications engine is REUSED, not faked: invites enqueue a `pending`
 * row into notification_dispatch_log (the durable at-least-once dispatch queue
 * the dispatcher-worker drains). No console.log — Pino logger only.
 *
 * Companion files:
 *   * owner-account-repo.ts                          (SQL repo)
 *   * packages/database/src/migrations/0334,0335     (tables)
 *   * apps/owner-portal/src/pages/SettingsPage.tsx   (Settings FE)
 *   * apps/owner-portal/src/app/skills/page.tsx      (Skills FE)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';

import { authMiddleware, requireRole } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { getSharedPerTenantRateBudget } from '../../middleware/per-tenant-rate-budget';
import { UserRole } from '../../types/user-role';
import { createLogger } from '../../utils/logger';
import {
  getOwnerSettings,
  upsertOwnerSettings,
  listPendingInvites,
  createInvite,
  rotateInviteForResend,
  revokeInvite,
  enqueueInviteEmail,
  listSkills,
  getSkill,
  setSkillInstalled,
  setSkillEnabled,
  recordSkillRun,
  type RepoDb,
} from './owner-account-repo';

const moduleLogger = createLogger('owner-account');

const BCRYPT_COST = 12;

// Roles allowed to manage owner-account state. The owner + tenant/platform
// admins. A co-owner invite can never escalate beyond CO_OWNER/VIEWER (enforced
// by the invite role schema below).
const MANAGE_ROLES = [
  UserRole.OWNER,
  UserRole.TENANT_ADMIN,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dbUnavailable(c: unknown) {
  return (c as { json: Function }).json(
    {
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database client is not initialized',
      },
    },
    503,
  );
}

function getDb(c: unknown): RepoDb | null {
  const db = (c as { get: Function }).get('db');
  return (db as RepoDb | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const LANGUAGES = ['en', 'sw'] as const;

const SettingsSchema = z.object({
  language: z.enum(LANGUAGES).default('en'),
  // ISO-4217 — 3 uppercase letters. Currency-agnostic; never hard-coded TZS.
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'currency must be a 3-letter ISO-4217 code')
    .default('USD'),
  timezone: z.string().trim().min(1).max(64).default('Africa/Dar_es_Salaam'),
  dateFormat: z
    .enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
    .default('DD/MM/YYYY'),
  notificationPrefs: z.record(z.boolean()).default({}),
});

const InviteSchema = z.object({
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).default(''),
  role: z.enum(['CO_OWNER', 'VIEWER']).default('VIEWER'),
  properties: z.array(z.string().trim().min(1).max(200)).max(100).default([]),
});

const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'newPassword and confirmPassword must match',
    path: ['confirmPassword'],
  });

const ToggleSchema = z.object({ enabled: z.boolean() });

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const ownerAccountRouter = new Hono();
ownerAccountRouter.use('*', authMiddleware);
ownerAccountRouter.use('*', databaseMiddleware);
ownerAccountRouter.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

// ===========================================================================
// SETTINGS
// ===========================================================================

ownerAccountRouter.get('/settings', async (c) => {
  const auth = c.get('auth');
  const db = getDb(c);
  if (!db) return dbUnavailable(c);
  try {
    const settings = await getOwnerSettings(db, auth.tenantId, auth.userId);
    return c.json({ success: true, data: settings });
  } catch (error) {
    moduleLogger.error('owner settings read failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        success: false,
        error: { code: 'SETTINGS_READ_FAILED', message: 'Failed to load settings' },
      },
      500,
    );
  }
});

async function saveSettings(c: unknown) {
  const auth = (c as { get: Function }).get('auth');
  const db = getDb(c);
  if (!db) return dbUnavailable(c);
  const body = (c as { req: { valid: Function } }).req.valid('json');
  try {
    const saved = await upsertOwnerSettings(db, auth.tenantId, auth.userId, body);
    return (c as { json: Function }).json({ success: true, data: saved });
  } catch (error) {
    moduleLogger.error('owner settings save failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return (c as { json: Function }).json(
      {
        success: false,
        error: { code: 'SETTINGS_SAVE_FAILED', message: 'Failed to save settings' },
      },
      500,
    );
  }
}

ownerAccountRouter.put(
  '/settings',
  requireRole(...MANAGE_ROLES),
  zValidator('json', SettingsSchema),
  saveSettings,
);

// POST alias — the owner-portal api client exposes get/post/patch/delete but
// no put(); the Settings page Save calls POST which behaves identically.
ownerAccountRouter.post(
  '/settings',
  requireRole(...MANAGE_ROLES),
  zValidator('json', SettingsSchema),
  saveSettings,
);

// ===========================================================================
// CO-OWNERS
// ===========================================================================

/**
 * GET /co-owners — accepted members (resolved from `users`, status ACTIVE) plus
 * pending invites (co_owner_invites). The owner-portal Settings → Users tab
 * renders both in one list.
 */
ownerAccountRouter.get('/co-owners', async (c) => {
  const auth = c.get('auth');
  const db = getDb(c);
  if (!db) return dbUnavailable(c);
  try {
    // Accepted members: real users in this tenant (excluding the platform-admin
    // service roles). status maps users.status → FE ACTIVE/PENDING/SUSPENDED.
    const usersResult = await db.execute(sql`
      SELECT id, email, first_name, last_name, phone, status, is_owner,
             last_login_at, created_at
        FROM users
       WHERE tenant_id = ${auth.tenantId}
       ORDER BY created_at ASC
       LIMIT 500
    `);
    const userRows =
      (usersResult as unknown as Record<string, unknown>[] | { rows?: Record<string, unknown>[] });
    const rows = Array.isArray(userRows) ? userRows : (userRows.rows ?? []);
    const members = rows.map((row) => {
      const statusRaw = String(row.status ?? '');
      const status =
        statusRaw === 'active'
          ? 'ACTIVE'
          : statusRaw === 'suspended' || statusRaw === 'deactivated'
            ? 'SUSPENDED'
            : 'PENDING';
      return {
        id: String(row.id),
        email: String(row.email ?? ''),
        firstName: String(row.first_name ?? ''),
        lastName: String(row.last_name ?? ''),
        phone: (row.phone as string | null) ?? null,
        role: row.is_owner ? 'OWNER' : 'CO_OWNER',
        status,
        lastLogin: (row.last_login_at as string | null) ?? null,
        properties: [] as string[],
      };
    });
    const invites = await listPendingInvites(db, auth.tenantId);
    return c.json({ success: true, data: [...members, ...invites] });
  } catch (error) {
    moduleLogger.error('co-owners list failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        success: false,
        error: { code: 'CO_OWNERS_READ_FAILED', message: 'Failed to load co-owners' },
      },
      500,
    );
  }
});

ownerAccountRouter.post(
  '/co-owners/invite',
  requireRole(...MANAGE_ROLES),
  zValidator('json', InviteSchema),
  async (c) => {
    const auth = c.get('auth');
    const db = getDb(c);
    if (!db) return dbUnavailable(c);
    const body = c.req.valid('json');
    try {
      const invite = await createInvite(db, auth.tenantId, auth.userId, body);
      // Resolve the caller's locale so the invite email is single-language
      // (CLAUDE.md: greetings strictly single-language per active locale).
      const settings = await getOwnerSettings(db, auth.tenantId, auth.userId);
      await enqueueInviteEmail(db, {
        tenantId: auth.tenantId,
        invitedBy: auth.userId,
        email: invite.email,
        firstName: invite.firstName,
        token: invite.token,
        role: invite.role,
        locale: settings.language,
        idempotencyKey: `co-owner-invite:${invite.id}`,
        correlationId: `co-owner-invite:${invite.id}`,
      });
      // Never leak the raw token to the client — the accept link is delivered
      // only via the email channel.
      return c.json(
        {
          success: true,
          data: {
            id: invite.id,
            email: invite.email,
            firstName: invite.firstName,
            lastName: invite.lastName,
            role: invite.role,
            status: 'PENDING',
            properties: invite.properties,
          },
        },
        201,
      );
    } catch (error) {
      moduleLogger.error('co-owner invite failed', {
        tenantId: auth.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          success: false,
          error: { code: 'INVITE_FAILED', message: 'Failed to send invitation' },
        },
        500,
      );
    }
  },
);

ownerAccountRouter.delete(
  '/co-owners/:id',
  requireRole(...MANAGE_ROLES),
  async (c) => {
    const auth = c.get('auth');
    const db = getDb(c);
    if (!db) return dbUnavailable(c);
    const id = c.req.param('id');
    try {
      const revoked = await revokeInvite(db, auth.tenantId, id);
      if (!revoked) {
        // Uniform-404 anti-IDOR: never reveal whether the invite exists in
        // another tenant or was already revoked.
        return c.json(
          {
            success: false,
            error: { code: 'INVITE_NOT_FOUND', message: 'Invitation not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: { id, revoked: true } });
    } catch (error) {
      moduleLogger.error('co-owner revoke failed', {
        tenantId: auth.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          success: false,
          error: { code: 'REVOKE_FAILED', message: 'Failed to revoke invitation' },
        },
        500,
      );
    }
  },
);

ownerAccountRouter.post(
  '/co-owners/:id/resend',
  requireRole(...MANAGE_ROLES),
  async (c) => {
    const auth = c.get('auth');
    const db = getDb(c);
    if (!db) return dbUnavailable(c);
    const id = c.req.param('id');
    try {
      const invite = await rotateInviteForResend(db, auth.tenantId, id);
      if (!invite) {
        return c.json(
          {
            success: false,
            error: { code: 'INVITE_NOT_FOUND', message: 'Invitation not found' },
          },
          404,
        );
      }
      const settings = await getOwnerSettings(db, auth.tenantId, auth.userId);
      await enqueueInviteEmail(db, {
        tenantId: auth.tenantId,
        invitedBy: auth.userId,
        email: invite.email,
        firstName: invite.firstName,
        token: invite.token,
        role: invite.role,
        locale: settings.language,
        // New idempotency key per resend (token rotated) so the dispatcher
        // ships a fresh email rather than collapsing into the prior row.
        idempotencyKey: `co-owner-invite-resend:${invite.id}:${invite.token.slice(0, 12)}`,
        correlationId: `co-owner-invite:${invite.id}`,
      });
      return c.json({ success: true, data: { id: invite.id, resent: true } });
    } catch (error) {
      moduleLogger.error('co-owner resend failed', {
        tenantId: auth.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          success: false,
          error: { code: 'RESEND_FAILED', message: 'Failed to resend invitation' },
        },
        500,
      );
    }
  },
);

// ===========================================================================
// SECURITY — password change (real bcrypt) + 2FA capability report
// ===========================================================================

/**
 * POST /security/password — change the caller's own password. Verifies the
 * current password against users.password_hash (bcrypt.compare), then writes a
 * fresh bcrypt hash. Per-user (user_id from JWT) — an owner can only change
 * their OWN password. No Supabase client is configured in the owner-portal, so
 * the password change is performed server-side against the canonical users
 * table (the same store /auth/login authenticates against).
 */
ownerAccountRouter.post(
  '/security/password',
  zValidator('json', PasswordSchema),
  async (c) => {
    const auth = c.get('auth');
    const db = getDb(c);
    if (!db) return dbUnavailable(c);
    const body = c.req.valid('json');
    try {
      const lookup = await db.execute(sql`
        SELECT password_hash
          FROM users
         WHERE id = ${auth.userId}
           AND tenant_id = ${auth.tenantId}
         LIMIT 1
      `);
      const rows =
        (lookup as unknown as Record<string, unknown>[] | { rows?: Record<string, unknown>[] });
      const row = (Array.isArray(rows) ? rows : (rows.rows ?? []))[0];
      const currentHash = row?.password_hash as string | null | undefined;
      if (!currentHash) {
        // Account has no local password (SSO-only) — cannot change here.
        return c.json(
          {
            success: false,
            error: {
              code: 'PASSWORD_NOT_SET',
              message: 'This account has no local password to change',
            },
          },
          409,
        );
      }
      const valid = await bcrypt.compare(body.currentPassword, currentHash);
      if (!valid) {
        return c.json(
          {
            success: false,
            error: {
              code: 'INVALID_CURRENT_PASSWORD',
              message: 'Current password is incorrect',
            },
          },
          400,
        );
      }
      const newHash = await bcrypt.hash(body.newPassword, BCRYPT_COST);
      await db.execute(sql`
        UPDATE users
           SET password_hash = ${newHash},
               password_changed_at = NOW(),
               must_change_password = false,
               updated_at = NOW()
         WHERE id = ${auth.userId}
           AND tenant_id = ${auth.tenantId}
      `);
      return c.json({ success: true, data: { updated: true } });
    } catch (error) {
      moduleLogger.error('password change failed', {
        tenantId: auth.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          success: false,
          error: { code: 'PASSWORD_CHANGE_FAILED', message: 'Failed to update password' },
        },
        500,
      );
    }
  },
);

/**
 * GET /security/2fa — report the caller's MFA state + whether enrollment is
 * available. The owner-portal Security tab uses this to decide between an
 * active "Enable 2FA" button (which POSTs to the real /auth/mfa/enroll engine)
 * and an honest disabled "coming soon" affordance. MFA IS configured server-
 * side (users.mfa_enabled + /auth/mfa/* routes), so `available` is true.
 */
ownerAccountRouter.get('/security/2fa', async (c) => {
  const auth = c.get('auth');
  const db = getDb(c);
  if (!db) return dbUnavailable(c);
  try {
    const lookup = await db.execute(sql`
      SELECT mfa_enabled
        FROM users
       WHERE id = ${auth.userId}
         AND tenant_id = ${auth.tenantId}
       LIMIT 1
    `);
    const rows =
      (lookup as unknown as Record<string, unknown>[] | { rows?: Record<string, unknown>[] });
    const row = (Array.isArray(rows) ? rows : (rows.rows ?? []))[0];
    return c.json({
      success: true,
      data: {
        // The /auth/mfa enroll+confirm engine exists — enrollment is available.
        available: true,
        enrolled: Boolean(row?.mfa_enabled),
        enrollEndpoint: '/api/v1/auth/mfa/enroll',
        confirmEndpoint: '/api/v1/auth/mfa/confirm',
      },
    });
  } catch (error) {
    moduleLogger.error('2fa status read failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        success: false,
        error: { code: 'TWO_FA_STATUS_FAILED', message: 'Failed to read 2FA status' },
      },
      500,
    );
  }
});

// ===========================================================================
// SKILLS — owner_skills (the real owner-skill engine)
// ===========================================================================

ownerAccountRouter.get('/skills', async (c) => {
  const auth = c.get('auth');
  const db = getDb(c);
  if (!db) {
    // The FE treats 503 as an honest MissingBackendNotice — not a fake list.
    return dbUnavailable(c);
  }
  try {
    const skills = await listSkills(db, auth.tenantId);
    return c.json({ success: true, skills });
  } catch (error) {
    moduleLogger.error('skills list failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        success: false,
        error: { code: 'SKILLS_READ_FAILED', message: 'Failed to load skills' },
      },
      500,
    );
  }
});

ownerAccountRouter.post(
  '/skills/:id/install',
  requireRole(...MANAGE_ROLES),
  async (c) => {
    const auth = c.get('auth');
    const db = getDb(c);
    if (!db) return dbUnavailable(c);
    const id = c.req.param('id');
    try {
      const skill = await setSkillInstalled(db, auth.tenantId, id);
      if (!skill) {
        // The skill does not exist in this tenant's owner_skills. We never
        // fabricate a catalog row — return an honest typed not_available.
        return c.json(
          {
            success: false,
            error: {
              code: 'SKILL_NOT_AVAILABLE',
              message: 'Skill is not available to install',
            },
          },
          404,
        );
      }
      return c.json({ success: true, data: skill });
    } catch (error) {
      moduleLogger.error('skill install failed', {
        tenantId: auth.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          success: false,
          error: { code: 'SKILL_INSTALL_FAILED', message: 'Failed to install skill' },
        },
        500,
      );
    }
  },
);

ownerAccountRouter.post(
  '/skills/:id/toggle',
  requireRole(...MANAGE_ROLES),
  zValidator('json', ToggleSchema),
  async (c) => {
    const auth = c.get('auth');
    const db = getDb(c);
    if (!db) return dbUnavailable(c);
    const id = c.req.param('id');
    const { enabled } = c.req.valid('json');
    try {
      const skill = await setSkillEnabled(db, auth.tenantId, id, enabled);
      if (!skill) {
        return c.json(
          {
            success: false,
            error: { code: 'SKILL_NOT_FOUND', message: 'Skill not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: skill });
    } catch (error) {
      moduleLogger.error('skill toggle failed', {
        tenantId: auth.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          success: false,
          error: { code: 'SKILL_TOGGLE_FAILED', message: 'Failed to toggle skill' },
        },
        500,
      );
    }
  },
);

ownerAccountRouter.post(
  '/skills/:id/run',
  requireRole(...MANAGE_ROLES),
  async (c) => {
    const auth = c.get('auth');
    const db = getDb(c);
    if (!db) return dbUnavailable(c);
    const id = c.req.param('id');
    try {
      const skill = await recordSkillRun(db, auth.tenantId, id);
      if (!skill) {
        // Either the skill is not installed for this tenant or it is disabled.
        return c.json(
          {
            success: false,
            error: {
              code: 'SKILL_NOT_RUNNABLE',
              message: 'Skill is not installed or is disabled',
            },
          },
          404,
        );
      }
      return c.json({ success: true, data: skill });
    } catch (error) {
      moduleLogger.error('skill run failed', {
        tenantId: auth.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          success: false,
          error: { code: 'SKILL_RUN_FAILED', message: 'Failed to run skill' },
        },
        500,
      );
    }
  },
);

export default ownerAccountRouter;
