// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union widens
//   across multiple c.json branches.

/**
 * /api/v1/admin/users — owner-portal UsersPage skeleton.
 *
 * Wave-2 commit 0ee27a0 converted UsersPage to render a
 * `MissingBackendNotice` declaring `GET /api/v1/admin/users` as the
 * missing endpoint. The user-administration domain (list/create/update
 * tenant users with role + property access) is partially covered by the
 * top-level `/users` router, but the owner-portal calls a different
 * shape (paginated list + role filter + status filter) that needs its
 * own surface.
 *
 * Note: `/api/v1/admin/roles` already exists via `bff/admin-portal.ts`
 * with an honest-empty `[]` response, so the FE for UserRolesPage does
 * not 404 today. We deliberately do NOT register a second `/admin/roles`
 * here to avoid masking the existing handler.
 *
 * Mounted at `/admin` in index.ts AFTER `adminPortalRouter`. Hono falls
 * through to this router for `/admin/users` because the existing
 * adminPortalRouter does not claim that path.
 *
 * TODO(api-gateway, ADMIN-USERS-001): wire the admin-user list endpoint.
 *   Concrete next-step:
 *     1. Add `repos.users.findManyForAdmin(tenantId, { page, limit,
 *        roleFilter, statusFilter })` returning
 *        `{ items, total, page, limit }`.
 *     2. Replace the degraded payload below with the real query.
 *     3. Add POST/PATCH/DELETE handlers for the full CRUD declared in
 *        the UsersPage header comment.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/hono-auth';
import { requireRole } from '../../middleware/authorization';
import { UserRole } from '../../types/user-role';
import { buildDegradedList, markDegraded } from './degraded-shape';

const NEXT_STEP =
  'add repos.users.findManyForAdmin(tenantId, filters) returning paginated user rows + replace this skeleton with real CRUD';

const app = new Hono();
app.use('*', authMiddleware);
// User administration is gated to tenant-admin and platform admin
// roles. OWNER role is granted view access (matching admin-portal's
// own gate) so the owner-portal UsersPage can render at all.
app.use(
  '*',
  requireRole(
    UserRole.OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  ),
);

app.get('/users', (c) => {
  const auth = c.get('auth');
  markDegraded(c);
  return c.json(buildDegradedList(auth.tenantId, NEXT_STEP));
});

export const adminUsersRouter = app;
