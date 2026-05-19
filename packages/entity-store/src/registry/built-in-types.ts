/**
 * Built-in entity types — kept in TypeScript so the package boots even
 * before the seed migration (0168) runs against a fresh database.
 *
 * The migration's INSERT statements mirror this list 1-to-1. If you add
 * a type here, also add a row to `0168_entity_seed_types.sql`.
 *
 * Schemas are declared with Zod and JSON-stringified for the registry
 * column. The runtime resolves them via `compileBuiltInSchema()`.
 */

import { z, type ZodTypeAny } from 'zod';
import type { EntityType } from '../types/entity.js';

export interface BuiltInTypeSpec {
  readonly name: string;
  readonly description: string;
  readonly jurisdictionAware: boolean;
  readonly scope: 'platform' | 'tenant' | 'both';
  readonly schema: ZodTypeAny;
}

// ----- Common reusable shapes -----

const personLike = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  nationalId: z.string().optional(),
});

const moneyLike = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().length(3), // ISO-4217 — never hardcoded
});

const addressLike = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().length(2), // ISO-3166-1 alpha-2
});

// ----- 14 built-in types -----

export const BUILT_IN_TYPES: ReadonlyArray<BuiltInTypeSpec> = [
  {
    name: 'employee',
    description:
      "An employee of an owner-customer's organisation (the owner's staff: caretaker, property manager, accountant, etc.). Distinct from internal-staff.",
    jurisdictionAware: true,
    scope: 'tenant',
    schema: personLike.extend({
      role: z.string().min(1),
      department: z.string().optional(),
      startDate: z.string(), // ISO-8601 date
      employmentType: z.enum(['full-time', 'part-time', 'contractor']).optional(),
      payRate: moneyLike.optional(),
    }),
  },
  {
    name: 'customer-owner',
    description:
      'An owner-customer of BOSSNYUMBA (the principal who owns properties and chats with the MD).',
    jurisdictionAware: true,
    scope: 'platform',
    schema: personLike.extend({
      taxId: z.string().optional(),
      portfolioName: z.string().optional(),
      onboardedAt: z.string().optional(),
    }),
  },
  {
    name: 'property',
    description:
      'A real-estate asset under management. Backed by the legacy `properties` table during migration; new properties flow through here.',
    jurisdictionAware: true,
    scope: 'tenant',
    schema: z.object({
      propertyCode: z.string().min(1),
      name: z.string().min(1),
      type: z.string().min(1),
      status: z.string().min(1),
      address: addressLike,
      yearBuilt: z.number().int().optional(),
      totalUnits: z.number().int().nonnegative().optional(),
    }),
  },
  {
    name: 'lease',
    description:
      'A tenancy contract between an owner and a tenant-person for a unit. Carries dates, rent, deposit, and renewal terms.',
    jurisdictionAware: true,
    scope: 'tenant',
    schema: z.object({
      unitId: z.string().min(1),
      tenantPersonId: z.string().min(1),
      startDate: z.string(),
      endDate: z.string().optional(),
      monthlyRent: moneyLike,
      depositAmount: moneyLike.optional(),
      status: z.enum(['draft', 'active', 'terminated', 'expired']),
    }),
  },
  {
    name: 'tenant-person',
    description:
      'A natural-person tenant occupying a unit (NOT a BOSSNYUMBA tenant-the-organisation). The "renter" in everyday English.',
    jurisdictionAware: true,
    scope: 'tenant',
    schema: personLike.extend({
      dateOfBirth: z.string().optional(),
      emergencyContact: personLike.partial().optional(),
    }),
  },
  {
    name: 'vendor',
    description:
      'A supplier (plumber, electrician, gardening service). Can be platform-scoped (BOSSNYUMBA-vetted marketplace) or tenant-scoped (owner-private).',
    jurisdictionAware: false,
    scope: 'both',
    schema: z.object({
      name: z.string().min(1),
      contact: personLike.partial().optional(),
      categories: z.array(z.string()).default([]),
      rating: z.number().min(0).max(5).optional(),
    }),
  },
  {
    name: 'lead',
    description:
      'A prospect — someone who has expressed interest. Platform-scoped leads are owner-customer prospects for BOSSNYUMBA; tenant-scoped leads are prospective renters for an owner.',
    jurisdictionAware: false,
    scope: 'both',
    schema: z.object({
      source: z.string().min(1),
      contact: personLike.partial().optional(),
      notes: z.string().optional(),
      score: z.number().min(0).max(100).optional(),
    }),
  },
  {
    name: 'deal',
    description:
      'A pipeline opportunity (negotiation in progress). Platform-scope = enterprise sales; tenant-scope = unit signing.',
    jurisdictionAware: false,
    scope: 'both',
    schema: z.object({
      title: z.string().min(1),
      value: moneyLike,
      stage: z.string().min(1),
      counterparty: z.string().optional(),
      expectedCloseDate: z.string().optional(),
    }),
  },
  {
    name: 'ticket',
    description:
      'A trouble-ticket / support request. Tenant-scope = maintenance request; platform-scope = customer-success issue against BOSSNYUMBA.',
    jurisdictionAware: false,
    scope: 'both',
    schema: z.object({
      subject: z.string().min(1),
      description: z.string().min(1),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).default('open'),
      assignee: z.string().optional(),
    }),
  },
  {
    name: 'kra-filing',
    description:
      'A Kenya Revenue Authority filing (jurisdiction-aware — TZ uses TRA, UG uses URA; the registry encoding remains generic by the `jurisdiction` attribute).',
    jurisdictionAware: true,
    scope: 'tenant',
    schema: z.object({
      jurisdiction: z.string().length(2), // KE / TZ / UG / ...
      filingType: z.string().min(1),
      period: z.string().min(1), // 'monthly:2026-04' / 'annual:2025'
      amountDue: moneyLike.optional(),
      filedAt: z.string().optional(),
      acknowledgement: z.string().optional(),
    }),
  },
  {
    name: 'campaign',
    description:
      'A marketing campaign (vacancy promotion, owner outreach, brand). Tenant-scope = owner-private outreach; platform-scope = BOSSNYUMBA growth.',
    jurisdictionAware: false,
    scope: 'both',
    schema: z.object({
      name: z.string().min(1),
      objective: z.string().min(1),
      channels: z.array(z.string()).default([]),
      budget: moneyLike.optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
    }),
  },
  {
    name: 'process-step',
    description:
      "A single step inside a multi-step workflow (used by the MD's plan/goal executor). Carries inputs, expected outputs, and status.",
    jurisdictionAware: false,
    scope: 'both',
    schema: z.object({
      processId: z.string().min(1),
      stepIndex: z.number().int().nonnegative(),
      action: z.string().min(1),
      status: z.enum(['pending', 'running', 'success', 'failed', 'skipped']).default('pending'),
      inputs: z.record(z.unknown()).default({}),
      outputs: z.record(z.unknown()).default({}),
    }),
  },
  {
    name: 'recommendation',
    description:
      "An MD-generated recommendation (e.g. 'raise unit B14 rent by 6.2%'). Carries evidence, confidence, and an action plan.",
    jurisdictionAware: false,
    scope: 'both',
    schema: z.object({
      subject: z.string().min(1),
      summary: z.string().min(1),
      evidence: z.array(z.string()).default([]),
      confidence: z.number().min(0).max(1),
      actionPlan: z.string().optional(),
      status: z.enum(['proposed', 'accepted', 'rejected', 'expired']).default('proposed'),
    }),
  },
  {
    name: 'internal-staff',
    description:
      "BOSSNYUMBA's OWN employees (engineering, support, sales, ops). Always platform-scope. Only the internal-admin role can read/write.",
    jurisdictionAware: false,
    scope: 'platform',
    schema: personLike.extend({
      team: z.string().min(1),
      role: z.string().min(1),
      startDate: z.string(),
      managerId: z.string().optional(),
    }),
  },
] as const;

/**
 * Look up the Zod schema for a built-in type. Returns `null` if not
 * built-in (the caller should fall back to a runtime-registered type
 * from the DB-backed registry).
 */
export function builtInSchemaFor(name: string): ZodTypeAny | null {
  const spec = BUILT_IN_TYPES.find((t) => t.name === name);
  return spec ? spec.schema : null;
}

/**
 * Render the built-in type list as `EntityType` rows for tests / seed
 * inspection. `schemaZod` is a JSON-safe string handle, not a runtime
 * Zod object.
 */
export function builtInsAsRegistryRows(now: () => Date = () => new Date()): ReadonlyArray<EntityType> {
  const ts = now().toISOString();
  return BUILT_IN_TYPES.map((spec) => ({
    name: spec.name,
    schemaZod: `built-in:${spec.name}`,
    jurisdictionAware: spec.jurisdictionAware,
    scope: spec.scope,
    description: spec.description,
    createdAt: ts,
  }));
}
