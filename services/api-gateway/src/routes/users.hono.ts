
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/hono-auth';
import { UserRole } from '../types/user-role';
import { databaseMiddleware } from '../middleware/database';
import { roles, userRoles } from '@bossnyumba/database';

import { withSecurityEvents } from '@bossnyumba/observability';

// Runtime validation at the trust boundary. Without this, PUT /users/:id
// trusted arbitrary JSON: a non-string name, an object where a phone was
// expected, or an out-of-enum status all flowed straight into the repo.
// `status` is constrained to the canonical user_status enum
// (migration 0001_initial.sql) so callers cannot persist arbitrary values.
const UpdateUserSchema = z
  .object({
    firstName: z.string().min(1).max(200).optional(),
    lastName: z.string().min(1).max(200).optional(),
    phone: z.string().max(40).optional(),
    status: z.enum(['pending_activation', 'active', 'suspended', 'deactivated']).optional(),
  })
  .strict();

type RoleInfo = { role: string; permissions: string[] };

// any — Drizzle select builder chain type widens through generics in a
// way that adds no safety when only structurally accessed. Rows are
// narrowed below via the `.select({…})` projection which TS infers.
type DrizzleDb = any;

async function getRoleMap(db: DrizzleDb, tenantId: string, userIds: string[]): Promise<Map<string, RoleInfo>> {
  if (!userIds.length) return new Map();
  const assignments = await db
    .select({
      userId: userRoles.userId,
      roleName: roles.name,
      permissions: roles.permissions,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.tenantId, tenantId), inArray(userRoles.userId, userIds), isNull(roles.deletedAt)));

  const roleMap = new Map<string, RoleInfo>();
  for (const row of assignments as Array<{ userId: string; roleName: string; permissions: unknown }>) {
    if (!roleMap.has(row.userId)) {
      roleMap.set(row.userId, {
        role: row.roleName,
        permissions: Array.isArray(row.permissions) ? (row.permissions as string[]) : [],
      });
    }
  }
  return roleMap;
}

type UserRow = {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status?: string;
  createdAt?: unknown;
  createdBy?: string;
  updatedAt?: unknown;
  updatedBy?: string;
};

function mapUser(row: UserRow, roleData?: RoleInfo) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone ?? undefined,
    status: String(row.status || 'pending_activation').toUpperCase(),
    role: roleData?.role || 'admin',
    permissions: roleData?.permissions || ['*'],
    propertyAccess: ['*'],
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

app.get('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');
  const page = Number(c.req.query('page') || '1');
  const pageSize = Number(c.req.query('pageSize') || '20');
  const search = c.req.query('search');
  const status = c.req.query('status')?.toLowerCase();
  const result = await repos.users.findMany(auth.tenantId, 1000, 0, { search, status });
  const roleMap = await getRoleMap(db, auth.tenantId, result.items.map((item: any) => item.id));
  const items = result.items.map((row: any) => mapUser(row, roleMap.get(row.id)));
  const offset = (page - 1) * pageSize;
  return c.json({
    success: true,
    data: items.slice(offset, offset + pageSize),
    pagination: {
      page,
      pageSize,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / pageSize),
      hasNextPage: offset + pageSize < items.length,
      hasPreviousPage: page > 1,
    },
  });
});

app.get('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');
  const row = await repos.users.findById(c.req.param('id'), auth.tenantId);
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  const roleMap = await getRoleMap(db, auth.tenantId, [row.id]);
  return c.json({ success: true, data: mapUser(row, roleMap.get(row.id)) });
});

// Roles that are allowed to create/manage users. Critical defense:
// without this check any authenticated user could POST /users with
// role=SUPER_ADMIN and escalate immediately.
const USER_WRITE_ROLES = new Set(['super_admin', 'admin', 'tenant_admin']);
// Only super_admin may create other super_admins or cross-tenant admins.
const SUPER_ADMIN_ONLY_ROLES = new Set(['super_admin']);

app.post('/', withSecurityEvents({ action: 'user.create', resource: 'user', severity: 'info' }, async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');

  // Authorization gate: only admins can create users.
  const callerRole = String(auth.role ?? '').toLowerCase();
  if (!USER_WRITE_ROLES.has(callerRole)) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'insufficient role to create users' } },
      403
    );
  }

  const body = await c.req.json();

  // A non-super-admin cannot mint a super-admin. This is the role-
  // escalation defense — previously POST /users trusted body.role
  // unconditionally.
  const requestedRole = String(body.role ?? '').toLowerCase();
  if (requestedRole && SUPER_ADMIN_ONLY_ROLES.has(requestedRole) && callerRole !== 'super_admin') {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'only super_admin can assign super_admin role' } },
      403
    );
  }

  // bcrypt cost factor 12 — roughly 250ms/hash on modern hardware. Higher
  // than the historical default of 10 which is now considered weak.
  const passwordHash = body.password ? await bcrypt.hash(body.password, 12) : undefined;
  const row = await repos.users.create({
    id: crypto.randomUUID(),
    tenantId: auth.tenantId,
    email: body.email?.trim().toLowerCase(),
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    passwordHash,
    status: 'active',
    createdBy: auth.userId,
    updatedBy: auth.userId,
  });

  if (body.role) {
    const roleRows = await db
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(and(eq(roles.tenantId, auth.tenantId), eq(roles.name, String(body.role).toLowerCase()), isNull(roles.deletedAt)))
      .limit(1);
    const role = roleRows[0];
    if (role) {
      await db.insert(userRoles).values({
        id: crypto.randomUUID(),
        userId: row.id,
        roleId: role.id,
        tenantId: auth.tenantId,
        assignedBy: auth.userId,
      });
    }
  }

  const roleMap = await getRoleMap(db, auth.tenantId, [row.id]);
  return c.json({ success: true, data: mapUser(row, roleMap.get(row.id)) }, 201);
}));

app.put('/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TENANT_ADMIN), zValidator('json', UpdateUserSchema), withSecurityEvents({ action: 'user.update', resource: 'user', severity: 'info' }, async (c: any) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const row = await repos.users.update(id, auth.tenantId, {
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    status: body.status?.toLowerCase(),
    updatedBy: auth.userId,
  });
  if (!row) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  const roleMap = await getRoleMap(db, auth.tenantId, [row.id]);
  return c.json({ success: true, data: mapUser(row, roleMap.get(row.id)) });
}));

app.delete('/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TENANT_ADMIN), withSecurityEvents({ action: 'user.delete', resource: 'user', severity: 'warn' }, async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  await repos.users.delete(c.req.param('id'), auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'User deleted' } });
}));

export const usersRouter = app;
