// @ts-nocheck

import { Hono } from 'hono';
import bcrypt from 'bcrypt';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { roles, userRoles } from '@bossnyumba/database';

async function getRoleMap(db: any, tenantId: string, userIds: string[]) {
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

  const roleMap = new Map<string, any>();
  for (const row of assignments) {
    if (!roleMap.has(row.userId)) {
      roleMap.set(row.userId, {
        role: row.roleName,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
      });
    }
  }
  return roleMap;
}

function mapUser(row: any, roleData?: any) {
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

app.post('/', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');
  const body = await c.req.json();
  const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : undefined;
  const row = await repos.users.create({
    id: crypto.randomUUID(),
    tenantId: auth.tenantId,
    email: body.email,
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
});

app.patch('/me', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');

  let body: any = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const updates: Record<string, unknown> = {
    updatedBy: auth.userId,
  };

  if (typeof body.region === 'string' && body.region.trim()) {
    updates.region = body.region.trim();
  }
  if (typeof body.language === 'string' && body.language.trim()) {
    updates.language = body.language.trim();
    // Keep locale in sync with language for notification template resolution
    updates.locale = body.language.trim().toLowerCase().slice(0, 2);
  }
  if (typeof body.firstName === 'string') updates.firstName = body.firstName;
  if (typeof body.lastName === 'string') updates.lastName = body.lastName;
  if (typeof body.phone === 'string') updates.phone = body.phone;

  if (Object.keys(updates).length === 1) {
    return c.json(
      { success: false, error: { code: 'NO_FIELDS', message: 'No valid fields provided' } },
      400
    );
  }

  const row = await repos.users.update(auth.userId, auth.tenantId, updates);
  if (!row) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
      404
    );
  }

  const roleMap = await getRoleMap(db, auth.tenantId, [row.id]);
  const mapped = mapUser(row, roleMap.get(row.id));
  return c.json({
    success: true,
    data: { ...mapped, region: row.region ?? null, language: row.language ?? null },
  });
});

app.put('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json();
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
});

app.delete('/:id', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  await repos.users.delete(c.req.param('id'), auth.tenantId, auth.userId);
  return c.json({ success: true, data: { message: 'User deleted' } });
});

export const usersRouter = app;
