/**
 * Tenant and Identity Schemas
 * Multi-tenant core tables with RLS support
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Enums
// ============================================================================

export const tenantStatusEnum = pgEnum('tenant_status', [
  'active',
  'suspended',
  'pending',
  'trial',
  'cancelled',
]);

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'starter',
  'professional',
  'enterprise',
  'custom',
]);

export const userStatusEnum = pgEnum('user_status', [
  'pending_activation',
  'active',
  'suspended',
  'deactivated',
]);

export const sessionStatusEnum = pgEnum('session_status', [
  'active',
  'expired',
  'revoked',
]);

export const membershipStatusEnum = pgEnum('membership_status', [
  'pending',
  'active',
  'revoked',
  'expired',
]);

export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'user.created',
  'user.updated',
  'user.deleted',
  'user.login',
  'user.logout',
  'user.password_changed',
  'tenant.created',
  'tenant.updated',
  'tenant.suspended',
  'role.assigned',
  'role.revoked',
  'permission.granted',
  'permission.revoked',
  'data.accessed',
  'data.modified',
  'data.exported',
]);

// ============================================================================
// Tenants Table
// ============================================================================

export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: tenantStatusEnum('status').notNull().default('pending'),
    subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('starter'),
    
    // Contact info
    primaryEmail: text('primary_email').notNull(),
    primaryPhone: text('primary_phone'),
    
    // Address
    addressLine1: text('address_line1'),
    addressLine2: text('address_line2'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    country: text('country').default('KE'),
    
    // Settings
    settings: jsonb('settings').default({}),
    billingSettings: jsonb('billing_settings').default({}),
    
    // Usage tracking
    maxUsers: integer('max_users').default(5),
    maxProperties: integer('max_properties').default(10),
    maxUnits: integer('max_units').default(100),
    currentUsers: integer('current_users').default(0),
    currentProperties: integer('current_properties').default(0),
    currentUnits: integer('current_units').default(0),
    
    // Trial
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    
    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(table.slug),
    statusIdx: index('tenants_status_idx').on(table.status),
    createdAtIdx: index('tenants_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// Organizations Table (for hierarchical tenant structure)
// ============================================================================

export const organizations = pgTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    level: integer('level').notNull().default(0),
    path: text('path').notNull(), // Materialized path for hierarchy queries
    isActive: boolean('is_active').notNull().default(true),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('organizations_tenant_idx').on(table.tenantId),
    codeIdx: uniqueIndex('organizations_code_tenant_idx').on(table.tenantId, table.code),
    parentIdx: index('organizations_parent_idx').on(table.parentId),
    pathIdx: index('organizations_path_idx').on(table.path),
  })
);

// ============================================================================
// Users Table
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id').references(() => organizations.id),
    
    // Identity
    email: text('email').notNull(),
    phone: text('phone'),
    passwordHash: text('password_hash'),
    
    // Profile
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    
    // Status
    status: userStatusEnum('status').notNull().default('pending_activation'),
    isOwner: boolean('is_owner').notNull().default(false),
    
    // Security
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    mfaSecret: text('mfa_secret'),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    
    // Invitation
    invitationToken: text('invitation_token'),
    invitationExpiresAt: timestamp('invitation_expires_at', { withTimezone: true }),
    invitedBy: text('invited_by'),
    
    // Activity tracking
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    lastLoginIp: text('last_login_ip'),
    
    // Preferences
    preferences: jsonb('preferences').default({}),
    timezone: text('timezone').default('Africa/Nairobi'),
    locale: text('locale').default('en'),
    region: text('region'),
    language: text('language'),
    
    // Timestamps
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('users_tenant_idx').on(table.tenantId),
    emailTenantIdx: uniqueIndex('users_email_tenant_idx').on(table.tenantId, table.email),
    orgIdx: index('users_org_idx').on(table.organizationId),
    statusIdx: index('users_status_idx').on(table.status),
    invitationTokenIdx: uniqueIndex('users_invitation_token_idx').on(table.invitationToken),
    regionIdx: index('users_region_idx').on(table.region),
    languageIdx: index('users_language_idx').on(table.language),
  })
);

// ============================================================================
// Roles Table
// ============================================================================

export const roles = pgTable(
  'roles',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    permissions: jsonb('permissions').notNull().default([]),
    isSystem: boolean('is_system').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    priority: integer('priority').notNull().default(0),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('roles_tenant_idx').on(table.tenantId),
    nameTenantIdx: uniqueIndex('roles_name_tenant_idx').on(table.tenantId, table.name),
    systemIdx: index('roles_system_idx').on(table.isSystem),
  })
);

// ============================================================================
// User Roles Junction Table
// ============================================================================

export const userRoles = pgTable(
  'user_roles',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    assignedBy: text('assigned_by'),
  },
  (table) => ({
    userRoleIdx: uniqueIndex('user_roles_user_role_idx').on(table.userId, table.roleId),
    tenantIdx: index('user_roles_tenant_idx').on(table.tenantId),
  })
);

// ============================================================================
// Sessions Table
// ============================================================================

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Session info
    status: sessionStatusEnum('status').notNull().default('active'),
    ipAddress: text('ip_address').notNull(),
    userAgent: text('user_agent'),
    deviceInfo: jsonb('device_info').default({}),
    
    // Security
    mfaVerified: boolean('mfa_verified').notNull().default(false),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    revokedBy: text('revoked_by'),
  },
  (table) => ({
    tenantIdx: index('sessions_tenant_idx').on(table.tenantId),
    userIdx: index('sessions_user_idx').on(table.userId),
    statusIdx: index('sessions_status_idx').on(table.status),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  })
);

// ============================================================================
// Memberships Table
// ============================================================================
//
// A membership attaches a user (or a not-yet-registered invite_email) to a
// tenant with a role. Pending memberships carry an invite_email + invite_token
// and are auto-activated on the user's first login.

export const memberships = pgTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // Target user (null while membership is still a pending invite)
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    inviteEmail: text('invite_email'),

    // Role granted on activation
    role: text('role').notNull().default('member'),

    // Invitation state
    status: membershipStatusEnum('status').notNull().default('pending'),
    inviteToken: text('invite_token'),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
    invitedBy: text('invited_by'),

    // Lifecycle
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('memberships_tenant_idx').on(table.tenantId),
    userIdx: index('memberships_user_idx').on(table.userId),
    statusIdx: index('memberships_status_idx').on(table.status),
    inviteEmailIdx: index('memberships_invite_email_idx').on(table.inviteEmail),
    inviteTokenIdx: uniqueIndex('memberships_invite_token_idx').on(table.inviteToken),
  })
);

// ============================================================================
// Audit Events Table (append-only)
// ============================================================================

export const auditEvents = pgTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    
    // Event info
    eventType: auditEventTypeEnum('event_type').notNull(),
    action: text('action').notNull(),
    description: text('description'),
    
    // Actor
    actorId: text('actor_id'),
    actorEmail: text('actor_email'),
    actorName: text('actor_name'),
    actorType: text('actor_type').notNull().default('user'),
    
    // Target
    targetType: text('target_type'),
    targetId: text('target_id'),
    
    // Context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    sessionId: text('session_id'),
    
    // Data
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    metadata: jsonb('metadata').default({}),
    
    // Timestamp (immutable)
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('audit_events_tenant_idx').on(table.tenantId),
    eventTypeIdx: index('audit_events_event_type_idx').on(table.eventType),
    actorIdx: index('audit_events_actor_idx').on(table.actorId),
    targetIdx: index('audit_events_target_idx').on(table.targetType, table.targetId),
    occurredAtIdx: index('audit_events_occurred_at_idx').on(table.occurredAt),
  })
);

// ============================================================================
// Memberships Table
// ============================================================================
//
// A membership attaches a user (or a not-yet-registered invite_email) to a
// tenant with a role. The active-org middleware reads this table to verify
// that a caller's `X-Active-Org` header points at a tenant they actually
// belong to (status = 'active'). Pending rows are auto-activated on the
// invitee's first login (see routes/auth.ts).

export const memberships = pgTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // Target user (null while still a pending invite)
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    inviteEmail: text('invite_email'),

    // Role granted on activation
    role: text('role').notNull().default('member'),

    // Invitation state
    status: membershipStatusEnum('status').notNull().default('pending'),
    inviteToken: text('invite_token'),
    inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
    invitedBy: text('invited_by'),

    // Lifecycle
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('memberships_tenant_idx').on(table.tenantId),
    userIdx: index('memberships_user_idx').on(table.userId),
    statusIdx: index('memberships_status_idx').on(table.status),
    inviteEmailIdx: index('memberships_invite_email_idx').on(table.inviteEmail),
    inviteTokenIdx: uniqueIndex('memberships_invite_token_idx').on(table.inviteToken),
    userTenantStatusIdx: index('memberships_user_tenant_status_idx').on(
      table.userId,
      table.tenantId,
      table.status,
    ),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  organizations: many(organizations),
  users: many(users),
  roles: many(roles),
  sessions: many(sessions),
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [memberships.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [organizations.tenantId],
    references: [tenants.id],
  }),
  parent: one(organizations, {
    fields: [organizations.parentId],
    references: [organizations.id],
    relationName: 'orgHierarchy',
  }),
  children: many(organizations, { relationName: 'orgHierarchy' }),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  userRoles: many(userRoles),
  sessions: many(sessions),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [roles.tenantId],
    references: [tenants.id],
  }),
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  tenant: one(tenants, {
    fields: [userRoles.tenantId],
    references: [tenants.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [sessions.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [memberships.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));
