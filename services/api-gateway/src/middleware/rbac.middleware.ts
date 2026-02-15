/**
 * RBAC (Role-Based Access Control) Middleware - BOSSNYUMBA
 *
 * Implements permission checks using authz-policy package:
 * - Role-based permission validation
 * - Resource-level access control
 * - Attribute-based conditions
 * - Approval workflow integration
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { AuthContext } from './auth.middleware';
import type { UserRole } from '../types/user-role';

// ============================================================================
// Types
// ============================================================================

export type Permission = string; // Format: "resource:action" or "resource:action:scope"

export type Action =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'list'
  | 'approve'
  | 'reject'
  | 'execute'
  | 'manage'
  | '*';

export type Scope = 'own' | 'tenant' | 'property' | 'all' | '*';

export interface ResourceContext {
  resourceType: string;
  resourceId?: string;
  ownerId?: string;
  propertyId?: string;
  tenantId?: string;
  amount?: number;
  attributes?: Record<string, unknown>;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  approvalDetails?: {
    approverRoles: UserRole[];
    threshold?: ApprovalThreshold;
  };
}

export interface ApprovalThreshold {
  role: UserRole;
  resource: string;
  action: string;
  maxAmount?: number;
  requiresApproval: boolean;
  approverRoles?: UserRole[];
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  effect: 'allow' | 'deny';
  roles: UserRole[];
  resources: string[];
  actions: Action[];
  conditions?: PolicyCondition[];
}

export interface PolicyCondition {
  type: 'attribute' | 'threshold' | 'time' | 'property' | 'ownership' | 'tenant';
  attribute?: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'between';
  value: unknown;
}

// ============================================================================
// Permission Definitions
// ============================================================================

export const PERMISSIONS: Record<string, UserRole[]> = {
  // User Management
  'users:create': ['SUPER_ADMIN', 'ADMIN', 'TENANT_ADMIN'],
  'users:read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'users:update': ['SUPER_ADMIN', 'ADMIN', 'TENANT_ADMIN'],
  'users:delete': ['SUPER_ADMIN', 'ADMIN'],
  'users:list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'TENANT_ADMIN', 'PROPERTY_MANAGER'],

  // Tenant Management
  'tenants:create': ['SUPER_ADMIN', 'ADMIN'],
  'tenants:read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'TENANT_ADMIN'],
  'tenants:update': ['SUPER_ADMIN', 'ADMIN', 'TENANT_ADMIN'],
  'tenants:delete': ['SUPER_ADMIN'],
  'tenants:list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],

  // Property Management
  'properties:create': ['TENANT_ADMIN'],
  'properties:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'MAINTENANCE_STAFF'],
  'properties:update': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'properties:delete': ['TENANT_ADMIN'],
  'properties:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'MAINTENANCE_STAFF'],

  // Unit Management
  'units:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'units:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'MAINTENANCE_STAFF', 'RESIDENT'],
  'units:update': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'units:delete': ['TENANT_ADMIN'],
  'units:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'MAINTENANCE_STAFF'],

  // Customer/Resident Management
  'customers:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'customers:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT'],
  'customers:update': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'customers:delete': ['TENANT_ADMIN'],
  'customers:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT'],

  // Lease Management
  'leases:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'leases:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'leases:read:own': ['RESIDENT'],
  'leases:update': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'leases:delete': ['TENANT_ADMIN'],
  'leases:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'leases:terminate': ['TENANT_ADMIN'],
  'leases:renew': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],

  // Invoice Management
  'invoices:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT'],
  'invoices:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'invoices:read:own': ['RESIDENT'],
  'invoices:update': ['TENANT_ADMIN', 'ACCOUNTANT'],
  'invoices:delete': ['TENANT_ADMIN'],
  'invoices:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'invoices:void': ['TENANT_ADMIN', 'ACCOUNTANT'],
  'invoices:waive': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],

  // Payment Management
  'payments:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT'],
  'payments:create:own': ['RESIDENT'],
  'payments:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'payments:read:own': ['RESIDENT'],
  'payments:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'payments:reconcile': ['TENANT_ADMIN', 'ACCOUNTANT'],
  'payments:refund': ['TENANT_ADMIN'],

  // Work Order Management
  'work_orders:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'],
  'work_orders:create:own': ['RESIDENT'],
  'work_orders:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'OWNER'],
  'work_orders:read:own': ['RESIDENT'],
  'work_orders:update': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'],
  'work_orders:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF', 'OWNER'],
  'work_orders:assign': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'work_orders:complete': ['MAINTENANCE_STAFF'],
  'work_orders:approve': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'OWNER'],

  // Report Management
  'reports:create': ['TENANT_ADMIN', 'ACCOUNTANT'],
  'reports:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER', 'SUPPORT'],
  'reports:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'reports:export': ['TENANT_ADMIN', 'ACCOUNTANT', 'OWNER'],

  // Approval Management
  'approvals:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT'],
  'approvals:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'approvals:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'approvals:approve': ['TENANT_ADMIN', 'OWNER'],
  'approvals:reject': ['TENANT_ADMIN', 'OWNER'],

  // Vendor Management
  'vendors:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'vendors:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'],
  'vendors:update': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'vendors:delete': ['TENANT_ADMIN'],
  'vendors:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'MAINTENANCE_STAFF'],

  // Document Management
  'documents:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT'],
  'documents:read': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],
  'documents:read:own': ['RESIDENT'],
  'documents:update': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'documents:delete': ['TENANT_ADMIN'],
  'documents:list': ['TENANT_ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'OWNER'],

  // Notification Management
  'notifications:create': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'notifications:read': ['*' as UserRole], // All authenticated users
  'notifications:send': ['TENANT_ADMIN', 'PROPERTY_MANAGER'],
  'notifications:broadcast': ['TENANT_ADMIN'],

  // Settings Management
  'settings:read': ['TENANT_ADMIN', 'OWNER'],
  'settings:update': ['TENANT_ADMIN'],

  // Audit Log
  'audit:read': ['SUPER_ADMIN', 'ADMIN', 'TENANT_ADMIN'],
  'audit:list': ['SUPER_ADMIN', 'ADMIN', 'TENANT_ADMIN'],
};

// ============================================================================
// Approval Thresholds
// ============================================================================

const approvalThresholds: ApprovalThreshold[] = [
  {
    role: 'ACCOUNTANT' as UserRole,
    resource: 'payments',
    action: 'refund',
    maxAmount: 100000,
    requiresApproval: true,
    approverRoles: ['TENANT_ADMIN' as UserRole],
  },
  {
    role: 'PROPERTY_MANAGER' as UserRole,
    resource: 'payments',
    action: 'refund',
    maxAmount: 50000,
    requiresApproval: true,
    approverRoles: ['TENANT_ADMIN' as UserRole, 'OWNER' as UserRole],
  },
  {
    role: 'PROPERTY_MANAGER' as UserRole,
    resource: 'invoices',
    action: 'waive',
    maxAmount: 50000,
    requiresApproval: false,
  },
  {
    role: 'PROPERTY_MANAGER' as UserRole,
    resource: 'invoices',
    action: 'waive',
    maxAmount: 200000,
    requiresApproval: true,
    approverRoles: ['TENANT_ADMIN' as UserRole],
  },
  {
    role: 'PROPERTY_MANAGER' as UserRole,
    resource: 'work_orders',
    action: 'approve',
    maxAmount: 500000,
    requiresApproval: false,
  },
  {
    role: 'PROPERTY_MANAGER' as UserRole,
    resource: 'work_orders',
    action: 'approve',
    maxAmount: 2000000,
    requiresApproval: true,
    approverRoles: ['TENANT_ADMIN' as UserRole, 'OWNER' as UserRole],
  },
];

// ============================================================================
// Authorization Engine
// ============================================================================

class RBACEngine {
  /**
   * Check if a permission is granted to a role
   */
  hasPermission(role: UserRole, permission: Permission, userPermissions: string[] = []): boolean {
    // Super admin has all permissions
    if (role === 'SUPER_ADMIN' || userPermissions.includes('*')) {
      return true;
    }

    // Check explicit user permissions
    if (userPermissions.includes(permission)) {
      return true;
    }

    // Check wildcard permissions
    const [resource, action] = permission.split(':');
    if (userPermissions.includes(`${resource}:*`) || userPermissions.includes(`*:${action}`)) {
      return true;
    }

    // Check role-based permissions
    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      return false;
    }

    if (allowedRoles.includes('*' as UserRole)) {
      return true;
    }

    return allowedRoles.includes(role);
  }

  /**
   * Check property access
   */
  hasPropertyAccess(auth: AuthContext, propertyId?: string): boolean {
    if (!propertyId) return true;
    if (auth.role === 'SUPER_ADMIN' || auth.propertyAccess.includes('*')) {
      return true;
    }
    return auth.propertyAccess.includes(propertyId);
  }

  /**
   * Check tenant isolation
   */
  hasTenantAccess(auth: AuthContext, tenantId?: string): boolean {
    if (!tenantId) return true;
    if (auth.role === 'SUPER_ADMIN' || auth.role === 'ADMIN') {
      return true;
    }
    return auth.tenantId === tenantId;
  }

  /**
   * Check ownership
   */
  isOwner(auth: AuthContext, ownerId?: string): boolean {
    if (!ownerId) return true;
    if (['SUPER_ADMIN', 'ADMIN', 'TENANT_ADMIN'].includes(auth.role)) {
      return true;
    }
    return auth.userId === ownerId;
  }

  /**
   * Check approval requirements
   */
  checkApprovalRequired(
    auth: AuthContext,
    resource: ResourceContext,
    action: string
  ): { required: boolean; threshold?: ApprovalThreshold } {
    const applicable = approvalThresholds.filter(
      (t) =>
        t.role === auth.role && t.resource === resource.resourceType && t.action === action
    );

    if (applicable.length === 0) {
      return { required: false };
    }

    const sorted = [...applicable].sort((a, b) => (b.maxAmount || 0) - (a.maxAmount || 0));
    const amount = resource.amount || 0;

    for (const threshold of sorted) {
      if (threshold.maxAmount !== undefined && amount <= threshold.maxAmount) {
        return {
          required: threshold.requiresApproval,
          threshold: threshold.requiresApproval ? threshold : undefined,
        };
      }
    }

    // Amount exceeds all thresholds
    return {
      required: true,
      threshold: {
        ...sorted[0],
        requiresApproval: true,
        approverRoles: ['TENANT_ADMIN' as UserRole, 'OWNER' as UserRole],
      },
    };
  }

  /**
   * Full authorization check
   */
  authorize(auth: AuthContext, permission: Permission, resource?: ResourceContext): AuthorizationResult {
    // Check basic permission
    if (!this.hasPermission(auth.role, permission, auth.permissions)) {
      return {
        allowed: false,
        reason: `Permission '${permission}' not granted to role '${auth.role}'`,
      };
    }

    if (!resource) {
      return { allowed: true };
    }

    // Check tenant isolation
    if (!this.hasTenantAccess(auth, resource.tenantId)) {
      return {
        allowed: false,
        reason: 'Access denied: tenant isolation violation',
      };
    }

    // Check property access
    if (!this.hasPropertyAccess(auth, resource.propertyId)) {
      return {
        allowed: false,
        reason: 'Access denied: no access to this property',
      };
    }

    // Check ownership for scoped permissions
    if (permission.endsWith(':own') && !this.isOwner(auth, resource.ownerId)) {
      return {
        allowed: false,
        reason: 'Access denied: resource ownership required',
      };
    }

    // Check approval requirements
    const [, action] = permission.split(':');
    const approvalCheck = this.checkApprovalRequired(auth, resource, action);

    if (approvalCheck.required && approvalCheck.threshold) {
      return {
        allowed: true,
        requiresApproval: true,
        approvalDetails: {
          approverRoles: approvalCheck.threshold.approverRoles || [],
          threshold: approvalCheck.threshold,
        },
      };
    }

    return { allowed: true };
  }
}

const rbacEngine = new RBACEngine();

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Require specific permission(s)
 */
export const requirePermission = (...permissions: Permission[]) => {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }

    for (const permission of permissions) {
      const result = rbacEngine.authorize(auth, permission);

      if (!result.allowed) {
        return c.json(
          {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: result.reason || 'Insufficient permissions',
            },
          },
          403
        );
      }
    }

    await next();
  });
};

/**
 * Require any of the specified permissions
 */
export const requireAnyPermission = (...permissions: Permission[]) => {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }

    const hasAny = permissions.some((p) => rbacEngine.authorize(auth, p).allowed);

    if (!hasAny) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          },
        },
        403
      );
    }

    await next();
  });
};

/**
 * Require specific role(s)
 */
export const requireRole = (...roles: UserRole[]) => {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }

    if (!roles.includes(auth.role)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Role '${auth.role}' does not have access`,
          },
        },
        403
      );
    }

    await next();
  });
};

/**
 * Require resource-level authorization with context
 */
export const authorizeResource = (
  permission: Permission,
  getResourceContext: (c: Context) => ResourceContext | Promise<ResourceContext>
) => {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }

    const resourceContext = await getResourceContext(c);
    const result = rbacEngine.authorize(auth, permission, resourceContext);

    if (!result.allowed) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: result.reason || 'Access denied',
          },
        },
        403
      );
    }

    if (result.requiresApproval) {
      c.set('requiresApproval', true);
      c.set('approvalDetails', result.approvalDetails);
    }

    await next();
  });
};

/**
 * Require property access
 */
export const requirePropertyAccess = (getPropertyId: (c: Context) => string | Promise<string>) => {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }

    if (auth.role === 'SUPER_ADMIN' || auth.propertyAccess.includes('*')) {
      await next();
      return;
    }

    const propertyId = await getPropertyId(c);

    if (!auth.propertyAccess.includes(propertyId)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No access to this property',
          },
        },
        403
      );
    }

    await next();
  });
};

/**
 * Require ownership of resource
 */
export const requireOwnership = (getOwnerId: (c: Context) => string | Promise<string>) => {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth') as AuthContext | undefined;

    if (!auth) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }

    if (['SUPER_ADMIN', 'ADMIN', 'TENANT_ADMIN'].includes(auth.role)) {
      await next();
      return;
    }

    const ownerId = await getOwnerId(c);

    if (auth.userId !== ownerId) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only access your own resources',
          },
        },
        403
      );
    }

    await next();
  });
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check authorization programmatically
 */
export function checkAuthorization(
  auth: AuthContext,
  permission: Permission,
  resource?: ResourceContext
): AuthorizationResult {
  return rbacEngine.authorize(auth, permission, resource);
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserRole): string[] {
  const permissions: string[] = [];

  for (const [permission, roles] of Object.entries(PERMISSIONS)) {
    if (roles.includes(role) || roles.includes('*' as UserRole)) {
      permissions.push(permission);
    }
  }

  return permissions;
}

/**
 * Check if role has specific permission
 */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role) || allowedRoles.includes('*' as UserRole);
}

// ============================================================================
// Hono Context Type Extension
// ============================================================================

declare module 'hono' {
  interface ContextVariableMap {
    requiresApproval?: boolean;
    approvalDetails?: {
      approverRoles: UserRole[];
      threshold?: ApprovalThreshold;
    };
  }
}

export { rbacEngine };
