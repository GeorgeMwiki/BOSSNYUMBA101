/**
 * Users routes - Hono with full CRUD, Zod validation, pagination
 * Production-ready with proper error handling, DTOs, and auth middleware
 * Database-first with mock data fallback
 *
 * GET /      - List users (SUPER_ADMIN, TENANT_ADMIN, PROPERTY_MANAGER, paginated)
 * GET /me    - Get current user
 * POST /     - Create user (SUPER_ADMIN, TENANT_ADMIN)
 * GET /:id   - Get user by ID
 * PATCH /:id - Update user
 * DELETE /:id - Soft delete user (SUPER_ADMIN, TENANT_ADMIN)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { UserRole } from '../types/user-role';
import {
  DEMO_USERS,
  DEMO_TENANT_USERS,
  DEMO_TENANT,
  paginate,
  getById,
} from '../data/mock-data';
import { authMiddleware, requireRole } from '../middleware/hono-auth';
import { databaseMiddleware, generateId, buildPaginationResponse } from '../middleware/database';
import {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  idParamSchema,
} from './validators';
import type { User } from '../types/mock-types';
import type { UserListItemDto, UserDetailDto } from './dtos';

const app = new Hono();

/** Map user + tenantUser to list item DTO */
function toUserListItemDto(
  user: User,
  role?: string,
  propertyAccess?: string[]
): UserListItemDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    role,
    propertyAccess,
    createdAt: user.createdAt,
  };
}

/** Map user + tenantUser to detail DTO */
function toUserDetailDto(
  user: User,
  role?: string,
  permissions?: string[],
  propertyAccess?: string[]
): UserDetailDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    role,
    permissions,
    propertyAccess,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Map a DB user row to a list item DTO shape */
function dbUserToListItem(row: Record<string, unknown>): UserListItemDto {
  return {
    id: row.id as string,
    email: row.email as string,
    firstName: row.firstName as string,
    lastName: row.lastName as string,
    status: row.status as string,
    role: row.role as string | undefined,
    propertyAccess: undefined,
    createdAt: row.createdAt as Date,
  };
}

/** Map a DB user row to a detail DTO shape */
function dbUserToDetail(row: Record<string, unknown>): UserDetailDto {
  return {
    id: row.id as string,
    email: row.email as string,
    firstName: row.firstName as string,
    lastName: row.lastName as string,
    phone: row.phone as string | undefined,
    status: row.status as string,
    role: row.role as string | undefined,
    permissions: undefined,
    propertyAccess: undefined,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

// All user routes require auth + database middleware
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// GET /users/me - Get current user (must be before /:id)
app.get('/me', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (!useMockData && repos) {
    try {
      const user = await repos.users.findById(auth.userId, auth.tenantId);
      if (!user) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
          404
        );
      }
      return c.json({
        success: true,
        data: {
          ...dbUserToDetail(user as Record<string, unknown>),
          role: auth.role,
          permissions: auth.permissions,
          propertyAccess: auth.propertyAccess,
          tenant: { id: auth.tenantId, name: auth.tenantId, slug: auth.tenantId },
        },
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const user = getById(DEMO_USERS, auth.userId);
  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
      404
    );
  }

  const tenantUser = DEMO_TENANT_USERS.find(
    (tu) => tu.tenantId === auth.tenantId && tu.userId === auth.userId
  );

  return c.json({
    success: true,
    data: {
      ...toUserDetailDto(user, auth.role, auth.permissions, auth.propertyAccess),
      tenant: tenantUser
        ? { id: auth.tenantId, name: DEMO_TENANT.name, slug: DEMO_TENANT.slug }
        : undefined,
    },
  });
});

// GET /users - List users (with pagination, filters)
app.get(
  '/',
  requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.PROPERTY_MANAGER),
  zValidator('query', listUsersQuerySchema),
  async (c) => {
    const auth = c.get('auth');
    const { page, pageSize, status, role, search } = c.req.valid('query');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const offset = (page - 1) * pageSize;
        const result = await repos.users.findMany(
          auth.tenantId,
          pageSize,
          offset,
          { status, role, search }
        );

        const enrichedData = result.items.map((row) =>
          dbUserToListItem(row as Record<string, unknown>)
        );

        return c.json({
          success: true,
          data: enrichedData,
          pagination: buildPaginationResponse(page, pageSize, result.total),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const tenantUserIds = DEMO_TENANT_USERS
      .filter((tu) => tu.tenantId === auth.tenantId)
      .map((tu) => tu.userId);

    let users = DEMO_USERS.filter((u) => tenantUserIds.includes(u.id));

    if (status) {
      users = users.filter((u) => u.status === status);
    }

    if (role) {
      const usersWithRole = DEMO_TENANT_USERS
        .filter((tu) => tu.tenantId === auth.tenantId && tu.role === role)
        .map((tu) => tu.userId);
      users = users.filter((u) => usersWithRole.includes(u.id));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.firstName.toLowerCase().includes(searchLower) ||
          u.lastName.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
      );
    }

    const result = paginate(users, page, pageSize);

    const enrichedData = result.data.map((user) => {
      const tenantUser = DEMO_TENANT_USERS.find(
        (tu) => tu.tenantId === auth.tenantId && tu.userId === user.id
      );
      return toUserListItemDto(
        user,
        tenantUser?.role,
        tenantUser?.propertyAccess
      );
    });

    return c.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination,
    });
  }
);

// POST /users - Create user (TENANT_ADMIN or SUPER_ADMIN only)
app.post(
  '/',
  requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN),
  zValidator('json', createUserSchema),
  async (c) => {
    const auth = c.get('auth');
    const data = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        // Check for existing user with same email
        const existing = await repos.users.findByEmail(data.email, auth.tenantId);
        if (existing) {
          return c.json(
            {
              success: false,
              error: { code: 'CONFLICT', message: 'A user with this email already exists' },
            },
            409
          );
        }

        const id = generateId();
        const newUser = await repos.users.create({
          id,
          tenantId: auth.tenantId,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role as any,
          status: 'active' as any,
          createdBy: auth.userId,
          updatedBy: auth.userId,
        });

        return c.json(
          {
            success: true,
            data: dbUserToListItem(newUser as Record<string, unknown>),
          },
          201
        );
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const existingUser = DEMO_USERS.find((u) => u.email.toLowerCase() === data.email.toLowerCase());
    if (existingUser) {
      return c.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'A user with this email already exists',
          },
        },
        409
      );
    }

    const id = `user-${Date.now()}`;
    const now = new Date();
    const newUser: User = {
      id,
      email: data.email,
      emailVerified: false,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      phoneVerified: false,
      status: 'ACTIVE',
      mfaEnabled: false,
      createdAt: now,
      createdBy: auth.userId,
      updatedAt: now,
      updatedBy: auth.userId,
    };
    DEMO_USERS.push(newUser);

    DEMO_TENANT_USERS.push({
      tenantId: auth.tenantId,
      userId: id,
      role: data.role as UserRole,
      permissions: [],
      propertyAccess: data.propertyAccess ?? ['*'],
      assignedAt: now,
      assignedBy: auth.userId,
    });

    return c.json(
      {
        success: true,
        data: toUserListItemDto(newUser, data.role as string, data.propertyAccess),
      },
      201
    );
  }
);

// GET /users/:id - Get user by ID
app.get('/:id', zValidator('param', idParamSchema), async (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');
  const repos = c.get('repos');
  const useMockData = c.get('useMockData');

  if (id !== auth.userId && ![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(auth.role)) {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' },
      },
      403
    );
  }

  if (!useMockData && repos) {
    try {
      const user = await repos.users.findById(id, auth.tenantId);
      if (!user) {
        return c.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
          404
        );
      }
      return c.json({
        success: true,
        data: dbUserToDetail(user as Record<string, unknown>),
      });
    } catch (error) {
      console.error('Database error, falling back to mock data:', error);
    }
  }

  // Fallback to mock data
  const user = getById(DEMO_USERS, id);
  const tenantUser = DEMO_TENANT_USERS.find(
    (tu) => tu.tenantId === auth.tenantId && tu.userId === id
  );

  if (!user || !tenantUser) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      },
      404
    );
  }

  return c.json({
    success: true,
    data: toUserDetailDto(
      user,
      tenantUser.role,
      tenantUser.permissions,
      tenantUser.propertyAccess
    ),
  });
});

// PATCH /users/:id - Update user
app.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateUserSchema),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const updates = c.req.valid('json');
    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (id !== auth.userId && ![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(auth.role)) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        },
        403
      );
    }

    if (!useMockData && repos) {
      try {
        const existing = await repos.users.findById(id, auth.tenantId);
        if (!existing) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
            404
          );
        }

        const updateData: Record<string, unknown> = { updatedBy: auth.userId };
        if (updates.firstName) updateData.firstName = updates.firstName;
        if (updates.lastName) updateData.lastName = updates.lastName;
        if (updates.phone !== undefined) updateData.phone = updates.phone;
        if (updates.status) updateData.status = updates.status.toLowerCase();
        if (updates.role && [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(auth.role)) {
          updateData.role = updates.role;
        }

        const updated = await repos.users.update(id, auth.tenantId, updateData as any);
        if (!updated) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
            404
          );
        }

        return c.json({
          success: true,
          data: dbUserToDetail(updated as Record<string, unknown>),
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const user = getById(DEMO_USERS, id);
    if (!user) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        },
        404
      );
    }

    const tenantUser = DEMO_TENANT_USERS.find(
      (tu) => tu.tenantId === auth.tenantId && tu.userId === id
    );

    const updated = {
      ...user,
      ...(updates.firstName && { firstName: updates.firstName }),
      ...(updates.lastName && { lastName: updates.lastName }),
      ...(updates.phone !== undefined && { phone: updates.phone }),
      ...(updates.status && { status: updates.status }),
      updatedAt: new Date(),
      updatedBy: auth.userId,
    };

    const idx = DEMO_USERS.findIndex((u) => u.id === id);
    if (idx >= 0) DEMO_USERS[idx] = updated;

    if (updates.role && [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(auth.role)) {
      const tuIdx = DEMO_TENANT_USERS.findIndex(
        (tu) => tu.tenantId === auth.tenantId && tu.userId === id
      );
      if (tuIdx >= 0) {
        DEMO_TENANT_USERS[tuIdx] = {
          ...DEMO_TENANT_USERS[tuIdx],
          role: updates.role as UserRole,
        };
      }
    }

    if (updates.propertyAccess && [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(auth.role)) {
      const tuIdx = DEMO_TENANT_USERS.findIndex(
        (tu) => tu.tenantId === auth.tenantId && tu.userId === id
      );
      if (tuIdx >= 0) {
        DEMO_TENANT_USERS[tuIdx] = {
          ...DEMO_TENANT_USERS[tuIdx],
          propertyAccess: updates.propertyAccess,
        };
      }
    }

    const finalTenantUser = DEMO_TENANT_USERS.find(
      (tu) => tu.tenantId === auth.tenantId && tu.userId === id
    );

    return c.json({
      success: true,
      data: toUserDetailDto(
        updated,
        updates.role ?? finalTenantUser?.role,
        finalTenantUser?.permissions,
        updates.propertyAccess ?? finalTenantUser?.propertyAccess
      ),
    });
  }
);

// DELETE /users/:id - Soft delete (deactivate) user
app.delete(
  '/:id',
  requireRole(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN),
  zValidator('param', idParamSchema),
  async (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');

    if (id === auth.userId) {
      return c.json(
        {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Cannot deactivate your own account' },
        },
        400
      );
    }

    const repos = c.get('repos');
    const useMockData = c.get('useMockData');

    if (!useMockData && repos) {
      try {
        const user = await repos.users.findById(id, auth.tenantId);
        if (!user) {
          return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
            404
          );
        }
        await repos.users.delete(id, auth.tenantId, auth.userId);
        return c.json({
          success: true,
          data: { id, message: 'User deactivated successfully' },
        });
      } catch (error) {
        console.error('Database error, falling back to mock data:', error);
      }
    }

    // Fallback to mock data
    const user = getById(DEMO_USERS, id);
    if (!user) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        },
        404
      );
    }

    const tenantUser = DEMO_TENANT_USERS.find(
      (tu) => tu.tenantId === auth.tenantId && tu.userId === id
    );
    if (!tenantUser && auth.role !== UserRole.SUPER_ADMIN) {
      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot deactivate user from another tenant' },
        },
        403
      );
    }

    const idx = DEMO_USERS.findIndex((u) => u.id === id);
    if (idx >= 0) {
      DEMO_USERS[idx] = { ...DEMO_USERS[idx], status: 'INACTIVE', updatedAt: new Date(), updatedBy: auth.userId };
    }

    return c.json({
      success: true,
      data: { id, message: 'User deactivated successfully' },
    });
  }
);

export const usersRouter = app;
