/**
 * Tenant Context Middleware - BOSSNYUMBA
 *
 * Sets up tenant context for multi-tenant requests:
 * - Tenant ID extraction and validation
 * - Tenant settings caching
 * - Tenant isolation enforcement
 * - Request scoping
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { AuthContext } from './auth.middleware';

// ============================================================================
// Types
// ============================================================================

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  settings: TenantSettings;
  features: TenantFeatures;
  limits: TenantLimits;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'pending' | 'cancelled';

export interface TenantSettings {
  timezone: string;
  currency: string;
  locale: string;
  dateFormat: string;
  fiscalYearStart: number; // Month (1-12)
  lateFeeEnabled: boolean;
  lateFeePercentage: number;
  gracePeriodDays: number;
  autoInvoiceEnabled: boolean;
  invoiceDueDays: number;
  reminderDays: number[];
  emailNotifications: boolean;
  smsNotifications: boolean;
  customBranding: boolean;
  logoUrl?: string;
  primaryColor?: string;
}

export interface TenantFeatures {
  maxProperties: number;
  maxUnits: number;
  maxUsers: number;
  advancedReporting: boolean;
  apiAccess: boolean;
  customWorkflows: boolean;
  mobileApp: boolean;
  smsNotifications: boolean;
  documentStorage: boolean;
  maintenanceModule: boolean;
  accountingIntegration: boolean;
  aiFeatures: boolean;
}

export interface TenantLimits {
  apiRequestsPerDay: number;
  storageGB: number;
  documentUploadsPerMonth: number;
  smsCredits: number;
  emailsPerDay: number;
}

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  settings: TenantSettings;
  features: TenantFeatures;
  limits: TenantLimits;
}

// ============================================================================
// Tenant Cache (In-Memory for Dev, Redis for Production)
// ============================================================================

interface TenantCache {
  get(tenantId: string): TenantConfig | undefined;
  set(tenantId: string, config: TenantConfig, ttlSeconds?: number): void;
  delete(tenantId: string): void;
  clear(): void;
}

class InMemoryTenantCache implements TenantCache {
  private cache = new Map<string, { config: TenantConfig; expiresAt: number }>();
  private defaultTTL = 300; // 5 minutes

  get(tenantId: string): TenantConfig | undefined {
    const entry = this.cache.get(tenantId);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(tenantId);
      return undefined;
    }

    return entry.config;
  }

  set(tenantId: string, config: TenantConfig, ttlSeconds = this.defaultTTL): void {
    this.cache.set(tenantId, {
      config,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  clear(): void {
    this.cache.clear();
  }
}

const tenantCache: TenantCache = new InMemoryTenantCache();

// ============================================================================
// Default Tenant Configuration
// ============================================================================

const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  timezone: 'Africa/Dar_es_Salaam',
  currency: 'TZS',
  locale: 'en-TZ',
  dateFormat: 'DD/MM/YYYY',
  fiscalYearStart: 1,
  lateFeeEnabled: true,
  lateFeePercentage: 5,
  gracePeriodDays: 5,
  autoInvoiceEnabled: true,
  invoiceDueDays: 5,
  reminderDays: [3, 1, 0, -3, -7],
  emailNotifications: true,
  smsNotifications: false,
  customBranding: false,
};

const DEFAULT_TENANT_FEATURES: TenantFeatures = {
  maxProperties: 10,
  maxUnits: 100,
  maxUsers: 20,
  advancedReporting: false,
  apiAccess: false,
  customWorkflows: false,
  mobileApp: true,
  smsNotifications: false,
  documentStorage: true,
  maintenanceModule: true,
  accountingIntegration: false,
  aiFeatures: false,
};

const DEFAULT_TENANT_LIMITS: TenantLimits = {
  apiRequestsPerDay: 10000,
  storageGB: 5,
  documentUploadsPerMonth: 500,
  smsCredits: 0,
  emailsPerDay: 1000,
};

// ============================================================================
// Tenant Loader (Mock - Replace with Database in Production)
// ============================================================================

async function loadTenantConfig(tenantId: string): Promise<TenantConfig | null> {
  // Check cache first
  const cached = tenantCache.get(tenantId);
  if (cached) return cached;

  // TODO: Load from database
  // For now, return mock data for any tenant ID
  const config: TenantConfig = {
    id: tenantId,
    name: `Tenant ${tenantId}`,
    slug: tenantId.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    status: 'active',
    settings: { ...DEFAULT_TENANT_SETTINGS },
    features: { ...DEFAULT_TENANT_FEATURES },
    limits: { ...DEFAULT_TENANT_LIMITS },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Cache the config
  tenantCache.set(tenantId, config);

  return config;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract tenant ID from request
 */
function extractTenantId(c: Context): string | null {
  // Priority order:
  // 1. Auth context (from JWT)
  const auth = c.get('auth') as AuthContext | undefined;
  if (auth?.tenantId) {
    return auth.tenantId;
  }

  // 2. X-Tenant-ID header
  const headerTenantId = c.req.header('X-Tenant-ID');
  if (headerTenantId) {
    return headerTenantId;
  }

  // 3. Subdomain extraction (tenant-slug.bossnyumba.com)
  const host = c.req.header('Host');
  if (host) {
    const parts = host.split('.');
    if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'api') {
      // This would need to be looked up by slug
      return parts[0];
    }
  }

  // 4. Query parameter (for testing/debug only)
  if (process.env.NODE_ENV === 'development') {
    const queryTenantId = c.req.query('tenantId');
    if (queryTenantId) {
      return queryTenantId;
    }
  }

  return null;
}

/**
 * Validate tenant status
 */
function isTenantActive(config: TenantConfig): boolean {
  return config.status === 'active' || config.status === 'trial';
}

/**
 * Check feature access
 */
function hasFeature(context: TenantContext, feature: keyof TenantFeatures): boolean {
  return Boolean(context.features[feature]);
}

/**
 * Check if limit is exceeded
 */
function isLimitExceeded(
  context: TenantContext,
  limit: keyof TenantLimits,
  currentUsage: number
): boolean {
  const maxValue = context.limits[limit];
  return currentUsage >= maxValue;
}

// ============================================================================
// Middleware Functions
// ============================================================================

/**
 * Main tenant context middleware
 * Extracts and validates tenant, sets context
 */
export const tenantContextMiddleware = createMiddleware(async (c, next) => {
  const tenantId = extractTenantId(c);

  if (!tenantId) {
    return c.json(
      {
        success: false,
        error: {
          code: 'MISSING_TENANT',
          message: 'Tenant context is required. Provide X-Tenant-ID header.',
        },
      },
      400
    );
  }

  const config = await loadTenantConfig(tenantId);

  if (!config) {
    return c.json(
      {
        success: false,
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'Tenant not found',
        },
      },
      404
    );
  }

  if (!isTenantActive(config)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'TENANT_INACTIVE',
          message: `Tenant account is ${config.status}. Please contact support.`,
        },
      },
      403
    );
  }

  // Set tenant context
  const tenantContext: TenantContext = {
    id: config.id,
    name: config.name,
    slug: config.slug,
    status: config.status,
    settings: config.settings,
    features: config.features,
    limits: config.limits,
  };

  c.set('tenant', tenantContext);

  // Set response header for debugging
  c.header('X-Tenant-ID', tenantId);

  await next();
});

/**
 * Optional tenant context middleware
 * Sets context if available, doesn't fail if missing
 */
export const optionalTenantContextMiddleware = createMiddleware(async (c, next) => {
  const tenantId = extractTenantId(c);

  if (tenantId) {
    const config = await loadTenantConfig(tenantId);

    if (config && isTenantActive(config)) {
      c.set('tenant', {
        id: config.id,
        name: config.name,
        slug: config.slug,
        status: config.status,
        settings: config.settings,
        features: config.features,
        limits: config.limits,
      } as TenantContext);

      c.header('X-Tenant-ID', tenantId);
    }
  }

  await next();
});

/**
 * Require specific tenant feature
 */
export const requireFeature = (feature: keyof TenantFeatures) => {
  return createMiddleware(async (c, next) => {
    const tenant = c.get('tenant') as TenantContext | undefined;

    if (!tenant) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_TENANT', message: 'Tenant context required' },
        },
        400
      );
    }

    if (!hasFeature(tenant, feature)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: `Feature '${feature}' is not available on your plan. Please upgrade.`,
            feature,
          },
        },
        403
      );
    }

    await next();
  });
};

/**
 * Enforce tenant limits
 */
export const enforceLimit = (
  limit: keyof TenantLimits,
  getCurrentUsage: (c: Context, tenantId: string) => number | Promise<number>
) => {
  return createMiddleware(async (c, next) => {
    const tenant = c.get('tenant') as TenantContext | undefined;

    if (!tenant) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_TENANT', message: 'Tenant context required' },
        },
        400
      );
    }

    const currentUsage = await getCurrentUsage(c, tenant.id);

    if (isLimitExceeded(tenant, limit, currentUsage)) {
      return c.json(
        {
          success: false,
          error: {
            code: 'LIMIT_EXCEEDED',
            message: `You have reached your ${limit} limit. Please upgrade your plan.`,
            limit,
            maxValue: tenant.limits[limit],
            currentUsage,
          },
        },
        403
      );
    }

    await next();
  });
};

/**
 * Ensure tenant isolation - request tenant matches auth tenant
 */
export const ensureTenantIsolation = createMiddleware(async (c, next) => {
  const auth = c.get('auth') as AuthContext | undefined;
  const tenant = c.get('tenant') as TenantContext | undefined;

  // Skip for platform admins
  if (auth && ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(auth.role)) {
    await next();
    return;
  }

  if (auth && tenant && auth.tenantId !== tenant.id) {
    return c.json(
      {
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Access denied: tenant isolation violation',
        },
      },
      403
    );
  }

  await next();
});

/**
 * Validate tenant-specific settings for operation
 */
export const validateTenantSettings = (
  validator: (settings: TenantSettings, c: Context) => boolean | string
) => {
  return createMiddleware(async (c, next) => {
    const tenant = c.get('tenant') as TenantContext | undefined;

    if (!tenant) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_TENANT', message: 'Tenant context required' },
        },
        400
      );
    }

    const result = validator(tenant.settings, c);

    if (result !== true) {
      return c.json(
        {
          success: false,
          error: {
            code: 'SETTING_VALIDATION_FAILED',
            message: typeof result === 'string' ? result : 'Operation not allowed by tenant settings',
          },
        },
        400
      );
    }

    await next();
  });
};

// ============================================================================
// Utility Exports
// ============================================================================

export {
  tenantCache,
  loadTenantConfig,
  extractTenantId,
  isTenantActive,
  hasFeature,
  isLimitExceeded,
  DEFAULT_TENANT_SETTINGS,
  DEFAULT_TENANT_FEATURES,
  DEFAULT_TENANT_LIMITS,
};

// ============================================================================
// Hono Context Type Extension
// ============================================================================

declare module 'hono' {
  interface ContextVariableMap {
    tenant: TenantContext;
  }
}
