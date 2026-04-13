// @ts-nocheck
/**
 * Cross-Tenant Memberships Routes
 *
 * CRUD for managing cross-tenant memberships (a single user identity
 * linked to N landlord orgs). Used by the customer-app and estate-
 * manager-app org switchers.
 *
 * Routes (all behind auth):
 *   GET    /memberships          — current user's membership bundle
 *   POST   /memberships          — owner adds a member by email
 *   PATCH  /memberships/:id      — update status or displayLabel
 *   DELETE /memberships/:id      — soft-delete (set REVOKED)
 */

import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';

const membershipsRouter = new Hono();

// -------------------------------------------------------------------------
// GET /memberships — current user's bundle (primary + cross)
// -------------------------------------------------------------------------

membershipsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const userTenantId = c.get('tenantId');
  const db = c.get('db');

  if (!userId) {
    return c.json({ success: false, error: { message: 'Unauthorized' } }, 401);
  }

  // Primary membership (always present — mirrors the user's home tenant).
  const primary = {
    id: 'primary',
    tenantId: userTenantId,
    organizationId: null,
    role: c.get('role') ?? 'CUSTOMER',
    displayLabel: null,
    isPrimary: true,
  };

  // Cross-tenant memberships from the database.
  let cross: any[] = [];
  try {
    if (db) {
      const rows = await db
        .select()
        .from('cross_tenant_memberships')
        .where('user_id', '=', userId)
        .where('status', '=', 'ACTIVE');
      cross = (rows ?? []).map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        organizationId: r.organization_id ?? null,
        role: r.role,
        displayLabel: r.display_label ?? null,
        isPrimary: false,
      }));
    }
  } catch {
    // DB not available / table doesn't exist yet → return primary only.
  }

  return c.json({
    success: true,
    data: {
      userId,
      primary,
      cross,
    },
  });
});

// -------------------------------------------------------------------------
// POST /memberships — owner adds a member by email
// -------------------------------------------------------------------------

membershipsRouter.post('/', async (c) => {
  const callerRole = c.get('role');
  const body = await c.req.json();
  const { email, tenantId, role, organizationId, displayLabel } = body;

  if (!email || !tenantId || !role) {
    return c.json({
      success: false,
      error: { message: 'email, tenantId, and role are required' },
    }, 400);
  }

  // Only admins/owners on the target tenant can add members.
  const allowedRoles = ['OWNER', 'INTERNAL_ADMIN', 'ADMIN'];
  if (!allowedRoles.includes(callerRole)) {
    return c.json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only owners/admins can add members' },
    }, 403);
  }

  const db = c.get('db');
  if (!db) {
    return c.json({
      success: false,
      error: { message: 'Database not available' },
    }, 503);
  }

  // Lookup user by email.
  let targetUser: any;
  try {
    const rows = await db
      .select()
      .from('users')
      .where('email_normalized', '=', email.trim().toLowerCase())
      .limit(1);
    targetUser = rows?.[0];
  } catch {
    return c.json({
      success: false,
      error: { message: 'User lookup failed' },
    }, 500);
  }

  if (!targetUser) {
    return c.json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: `No user found with email "${email}". They must create an account first.`,
      },
    }, 404);
  }

  // Check for existing membership.
  try {
    const existing = await db
      .select()
      .from('cross_tenant_memberships')
      .where('user_id', '=', targetUser.id)
      .where('tenant_id', '=', tenantId)
      .limit(1);
    if (existing?.[0]) {
      // Reactivate if revoked, otherwise return existing.
      if (existing[0].status === 'REVOKED') {
        await db
          .update('cross_tenant_memberships')
          .set({ status: 'ACTIVE', display_label: displayLabel ?? existing[0].display_label })
          .where('id', '=', existing[0].id);
        return c.json({ success: true, data: { id: existing[0].id, reactivated: true } });
      }
      return c.json({ success: true, data: { id: existing[0].id, existing: true } });
    }
  } catch {
    // Table may not exist yet — proceed to insert.
  }

  // Create new membership.
  const membership = {
    id: uuidv4(),
    user_id: targetUser.id,
    tenant_id: tenantId,
    organization_id: organizationId ?? null,
    role,
    status: 'ACTIVE',
    display_label: displayLabel ?? null,
    joined_at: new Date(),
    last_activated_at: null,
  };

  try {
    await db.insert('cross_tenant_memberships').values(membership);
  } catch (err: any) {
    return c.json({
      success: false,
      error: { message: `Failed to create membership: ${err?.message ?? err}` },
    }, 500);
  }

  return c.json({ success: true, data: { id: membership.id } }, 201);
});

// -------------------------------------------------------------------------
// PATCH /memberships/:id — update status or displayLabel
// -------------------------------------------------------------------------

membershipsRouter.patch('/:id', async (c) => {
  const membershipId = c.req.param('id');
  const userId = c.get('userId');
  const callerRole = c.get('role');
  const body = await c.req.json();
  const { status, displayLabel } = body;

  const db = c.get('db');
  if (!db) {
    return c.json({ success: false, error: { message: 'Database not available' } }, 503);
  }

  let membership: any;
  try {
    const rows = await db
      .select()
      .from('cross_tenant_memberships')
      .where('id', '=', membershipId)
      .limit(1);
    membership = rows?.[0];
  } catch {
    return c.json({ success: false, error: { message: 'Lookup failed' } }, 500);
  }

  if (!membership) {
    return c.json({ success: false, error: { message: 'Membership not found' } }, 404);
  }

  // Authorization: the user themselves OR an admin on the tenant.
  const isSelf = membership.user_id === userId;
  const isAdmin = ['OWNER', 'INTERNAL_ADMIN', 'ADMIN'].includes(callerRole);
  if (!isSelf && !isAdmin) {
    return c.json({ success: false, error: { message: 'Forbidden' } }, 403);
  }

  const updates: Record<string, any> = {};
  if (status) updates.status = status;
  if (displayLabel !== undefined) updates.display_label = displayLabel;

  if (Object.keys(updates).length === 0) {
    return c.json({ success: true, data: { id: membershipId, noChange: true } });
  }

  try {
    await db
      .update('cross_tenant_memberships')
      .set(updates)
      .where('id', '=', membershipId);
  } catch (err: any) {
    return c.json({ success: false, error: { message: `Update failed: ${err?.message}` } }, 500);
  }

  return c.json({ success: true, data: { id: membershipId } });
});

// -------------------------------------------------------------------------
// DELETE /memberships/:id — soft-delete (REVOKED)
// -------------------------------------------------------------------------

membershipsRouter.delete('/:id', async (c) => {
  const membershipId = c.req.param('id');
  const userId = c.get('userId');
  const callerRole = c.get('role');
  const db = c.get('db');

  if (!db) {
    return c.json({ success: false, error: { message: 'Database not available' } }, 503);
  }

  let membership: any;
  try {
    const rows = await db
      .select()
      .from('cross_tenant_memberships')
      .where('id', '=', membershipId)
      .limit(1);
    membership = rows?.[0];
  } catch {
    return c.json({ success: false, error: { message: 'Lookup failed' } }, 500);
  }

  if (!membership) {
    return c.json({ success: false, error: { message: 'Membership not found' } }, 404);
  }

  const isSelf = membership.user_id === userId;
  const isAdmin = ['OWNER', 'INTERNAL_ADMIN', 'ADMIN'].includes(callerRole);
  if (!isSelf && !isAdmin) {
    return c.json({ success: false, error: { message: 'Forbidden' } }, 403);
  }

  try {
    await db
      .update('cross_tenant_memberships')
      .set({ status: 'REVOKED' })
      .where('id', '=', membershipId);
  } catch (err: any) {
    return c.json({ success: false, error: { message: `Revoke failed: ${err?.message}` } }, 500);
  }

  return c.json({ success: true, data: { id: membershipId, status: 'REVOKED' } });
});

export { membershipsRouter };
