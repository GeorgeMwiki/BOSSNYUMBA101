/**
 * User Role Enum for API Gateway
 *
 * Roles support the dynamic context system where a single user
 * can hold multiple roles simultaneously (e.g., owner + tenant).
 *
 * TECHNICIAN role is mobile-only (no web interface).
 */

export const UserRole = {
  // Platform Admin Roles (BOSSNYUMBA Internal)
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  SUPPORT: 'SUPPORT',

  // Tenant Admin Roles
  TENANT_ADMIN: 'TENANT_ADMIN',
  PROPERTY_MANAGER: 'PROPERTY_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  MAINTENANCE_STAFF: 'MAINTENANCE_STAFF',

  // Technician Role (mobile-only - no web interface)
  TECHNICIAN: 'TECHNICIAN',

  // External User Roles (dynamic - same user can hold multiple)
  OWNER: 'OWNER',
  RESIDENT: 'RESIDENT',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Check if a role is a platform-level admin role
 */
export function isPlatformAdmin(role: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.ADMIN ||
    role === UserRole.SUPPORT
  );
}

/**
 * Check if a role is a tenant admin role
 */
export function isTenantAdmin(role: UserRole): boolean {
  return role === UserRole.TENANT_ADMIN || role === UserRole.SUPER_ADMIN;
}

/**
 * Check if a role is technician (mobile-only, no web interface)
 */
export function isTechnician(role: UserRole): boolean {
  return role === UserRole.TECHNICIAN || role === UserRole.MAINTENANCE_STAFF;
}

/**
 * Check if a role has web portal access
 * Technicians are mobile-only - they use the Flutter app exclusively.
 */
export function hasWebAccess(role: UserRole): boolean {
  return role !== UserRole.TECHNICIAN;
}

/**
 * Map context_type to UserRole
 */
export function contextTypeToRole(contextType: string): UserRole {
  const mapping: Record<string, UserRole> = {
    owner: UserRole.OWNER,
    tenant: UserRole.RESIDENT,
    technician: UserRole.TECHNICIAN,
    manager: UserRole.PROPERTY_MANAGER,
    admin: UserRole.TENANT_ADMIN,
  };
  return mapping[contextType] || UserRole.RESIDENT;
}

/**
 * Get human-readable role name
 */
export function getRoleName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    SUPPORT: 'Support',
    TENANT_ADMIN: 'Tenant Admin',
    PROPERTY_MANAGER: 'Property Manager',
    ACCOUNTANT: 'Accountant',
    MAINTENANCE_STAFF: 'Maintenance Staff',
    TECHNICIAN: 'Technician',
    OWNER: 'Owner',
    RESIDENT: 'Resident',
  };
  return names[role] || role;
}

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: UserRole): string[] {
  const basePermissions: Record<UserRole, string[]> = {
    SUPER_ADMIN: ['*'],
    ADMIN: ['users:*', 'tenants:*', 'reports:*', 'settings:*'],
    SUPPORT: ['users:read', 'tenants:read', 'reports:read'],
    TENANT_ADMIN: [
      'users:*', 'properties:*', 'units:*', 'leases:*',
      'invoices:*', 'payments:*', 'reports:*',
    ],
    PROPERTY_MANAGER: [
      'properties:read', 'units:*', 'leases:*',
      'work_orders:*', 'customers:*', 'inspections:*',
    ],
    ACCOUNTANT: ['invoices:*', 'payments:*', 'reports:read'],
    MAINTENANCE_STAFF: ['work_orders:*', 'units:read'],
    TECHNICIAN: ['work_orders:read:assigned', 'work_orders:update:assigned', 'units:read'],
    OWNER: [
      'properties:read', 'units:read', 'leases:read',
      'invoices:read', 'payments:read', 'reports:read', 'approvals:*',
    ],
    RESIDENT: [
      'leases:read:own', 'invoices:read:own',
      'payments:create:own', 'work_orders:create:own',
    ],
  };
  return basePermissions[role] || [];
}
