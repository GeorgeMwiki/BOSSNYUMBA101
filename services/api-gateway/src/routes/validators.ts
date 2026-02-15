/**
 * Zod validation schemas for API routes
 */

import type { Context } from 'hono';
import { z } from 'zod';
import type { ZodError } from 'zod';

/**
 * Custom hook for zValidator - returns consistent error format matching API Gateway conventions.
 * Use as third arg: zValidator('json', schema, validationErrorHook)
 */
export function validationErrorHook(result: { success: false; error: ZodError } | { success: true; data: unknown }, c: Context) {
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.errors.map((e) => ({
            path: e.path.join('.') || '(root)',
            message: e.message,
          })),
        },
      },
      400
    );
  }
}

// Common schemas
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const propertyStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'UNDER_CONSTRUCTION',
]);
export const propertyTypeSchema = z.enum(['RESIDENTIAL', 'COMMERCIAL', 'MIXED']);
export const unitStatusSchema = z.enum([
  'AVAILABLE',
  'OCCUPIED',
  'MAINTENANCE',
  'RESERVED',
]);

// Address schema
export const addressSchema = z.object({
  line1: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  region: z.string().max(100).optional(),
  country: z.string().min(1).max(100),
  coordinates: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
});

// Sort order
export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');

// Properties schemas
export const listPropertiesQuerySchema = paginationQuerySchema.extend({
  status: propertyStatusSchema.optional(),
  type: propertyTypeSchema.optional(),
  city: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'city', 'status']).default('name'),
  sortOrder: sortOrderSchema,
});

export const createPropertySchema = z.object({
  name: z.string().min(1).max(200),
  type: propertyTypeSchema,
  status: propertyStatusSchema.default('ACTIVE'),
  address: addressSchema,
  description: z.string().max(2000).optional(),
  amenities: z.array(z.string().max(100)).default([]),
  images: z.array(z.string().url()).default([]),
  managerId: z.string().optional(),
  totalUnits: z.number().int().min(0).default(0),
  occupiedUnits: z.number().int().min(0).default(0),
  settings: z.record(z.unknown()).optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

export const assignManagerSchema = z.object({
  /** Manager user ID, or null to unassign */
  managerId: z.union([z.string().min(1, 'Manager ID required when assigning'), z.null()]),
});

// Units schemas
export const listUnitsQuerySchema = paginationQuerySchema.extend({
  status: unitStatusSchema.optional(),
  type: z.string().max(50).optional(),
  propertyId: z.string().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['unitNumber', 'floor', 'rentAmount', 'status', 'createdAt']).default('unitNumber'),
  sortOrder: sortOrderSchema,
});

export const createUnitSchema = z.object({
  propertyId: z.string().min(1),
  unitNumber: z.string().min(1).max(50),
  floor: z.number().int().min(0).optional(),
  type: z.string().min(1).max(50),
  status: unitStatusSchema.default('AVAILABLE'),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  squareMeters: z.number().min(0).optional(),
  rentAmount: z.number().min(0),
  depositAmount: z.number().min(0),
  amenities: z.array(z.string().max(100)).default([]),
  images: z.array(z.string().url()).default([]),
});

export const updateUnitSchema = createUnitSchema.partial().omit({ propertyId: true });

export const updateUnitStatusSchema = z.object({
  status: unitStatusSchema,
});

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(50).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

// Tenant schemas
export const tenantStatusSchema = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'PENDING',
  'CHURNED',
]);

export const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  primaryEmail: z.string().email(),
  contactPhone: z.string().max(50).optional(),
  status: tenantStatusSchema.default('PENDING'),
  settings: z.record(z.unknown()).optional(),
});

export const updateTenantSchema = createTenantSchema.partial();

export const updateTenantSettingsSchema = z.object({
  timezone: z.string().max(100).optional(),
  currency: z.string().max(10).optional(),
  locale: z.string().max(20).optional(),
  features: z.array(z.string()).optional(),
  policies: z.record(z.unknown()).optional(),
});

export const listTenantsQuerySchema = paginationQuerySchema.extend({
  status: tenantStatusSchema.optional(),
  search: z.string().max(200).optional(),
});

// User schemas
export const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']);

export const listUsersQuerySchema = paginationQuerySchema.extend({
  status: userStatusSchema.optional(),
  role: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(50).optional(),
  role: z.string().min(1),
  propertyAccess: z.array(z.string()).default(['*']),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(50).optional(),
  status: userStatusSchema.optional(),
  role: z.string().optional(),
  propertyAccess: z.array(z.string()).optional(),
});

// ============ Work Order schemas ============
export const workOrderStatusSchema = z.enum([
  'SUBMITTED',
  'TRIAGED',
  'APPROVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const workOrderPrioritySchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'EMERGENCY',
]);

export const workOrderCategorySchema = z.enum([
  'PLUMBING',
  'ELECTRICAL',
  'HVAC',
  'GENERAL',
  'APPLIANCE',
  'STRUCTURAL',
]);

export const listWorkOrdersQuerySchema = paginationQuerySchema.extend({
  status: workOrderStatusSchema.optional(),
  priority: workOrderPrioritySchema.optional(),
  category: workOrderCategorySchema.optional(),
  propertyId: z.string().optional(),
  vendorId: z.string().optional(),
});

export const createWorkOrderSchema = z.object({
  unitId: z.string().min(1, 'Unit ID is required'),
  propertyId: z.string().min(1, 'Property ID is required'),
  customerId: z.string().optional(),
  category: workOrderCategorySchema,
  priority: workOrderPrioritySchema.default('MEDIUM'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  evidence: z.record(z.unknown()).optional(),
});

export const updateWorkOrderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  category: workOrderCategorySchema.optional(),
  priority: workOrderPrioritySchema.optional(),
  estimatedCost: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
  evidence: z.record(z.unknown()).optional(),
  notes: z.array(z.unknown()).optional(),
});

export const triageWorkOrderSchema = z.object({
  priority: workOrderPrioritySchema,
  category: workOrderCategorySchema.optional(),
});

export const assignWorkOrderSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  scheduledAt: z.union([z.string(), z.coerce.date()]).optional(),
});

export const scheduleWorkOrderSchema = z.object({
  scheduledAt: z.union([z.string(), z.coerce.date()]),
});

export const completeWorkOrderSchema = z.object({
  actualCost: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export const verifyWorkOrderSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(2000).optional(),
});

export const escalateWorkOrderSchema = z.object({
  reason: z.string().min(1, 'Escalation reason is required').max(500),
});

export const pauseSlaSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ============ Vendor schemas ============
export const listVendorsQuerySchema = paginationQuerySchema.extend({
  category: workOrderCategorySchema.optional(),
  available: z.coerce.boolean().optional(),
  search: z.string().max(200).optional(),
});

export const createVendorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  companyName: z.string().max(200).optional(),
  email: z.string().email('Invalid email'),
  phone: z.string().min(1, 'Phone is required').max(50),
  categories: z.array(workOrderCategorySchema).min(1, 'At least one category required'),
  isAvailable: z.boolean().default(true),
});

export const updateVendorSchema = createVendorSchema.partial();

export const availableVendorsQuerySchema = z.object({
  category: workOrderCategorySchema,
  propertyId: z.string().optional(),
});
