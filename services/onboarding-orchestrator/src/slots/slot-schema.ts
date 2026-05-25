/**
 * Onboarding slot schema — 30+ named slots that together describe a
 * landlord/PM's entire operation.
 *
 * Research: `.audit/litfin-sota-2026-05-23/20-zero-friction-onboarding.md`
 * §2 (LLM slot-fill with fixed interview budget) and §11 (discovery
 * script). The bank is sized so the Macquarie/ACL 2026 info-gain
 * ranker picks the next ≤12 highest-gain questions from this set.
 *
 * Every slot is:
 *   * a stable key (NEVER renamed — persisted in `onboarding_sessions.slots`)
 *   * a Zod value schema (validates extracted answer)
 *   * a category (info-gain prior — `tenant_identity` ranks higher than
 *     `pain_points`, etc.)
 *   * an optional `prior` (0..1) used as the prior info-gain weight.
 *   * optional `dependsOn` keys (the ranker delays a slot until its
 *     parents are filled — "how many units per building?" requires
 *     `portfolio_property_names` first)
 *   * `prompts` per BCP-47 language tag (the agent surfaces the one
 *     that matches `session.locale`)
 *
 * Adding a new slot is intentionally one place — slot definitions are
 * the source of truth for the ranker, the discovery script, and the
 * bootstrapper's blueprint validators.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Categories — used by the ranker as a coarse info-gain prior.
// ---------------------------------------------------------------------------

export const SLOT_CATEGORIES = [
  'tenant_identity',
  'portfolio',
  'team',
  'processes',
  'tools_money',
  'tools_comms',
  'tools_records',
  'compliance',
  'pain_points',
  'jurisdiction',
] as const;

export type SlotCategory = (typeof SLOT_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Slot definition.
// ---------------------------------------------------------------------------

export interface SlotPrompts {
  readonly 'en-KE': string;
  readonly 'sw-KE'?: string;
  readonly 'lg-UG'?: string;
  readonly 'ha-NG'?: string;
}

export interface SlotDefinition<T = unknown> {
  readonly key: string;
  readonly category: SlotCategory;
  readonly schema: z.ZodType<T>;
  /** 0..1, higher → ask earlier. Default 0.5. */
  readonly prior: number;
  readonly dependsOn?: readonly string[];
  readonly prompts: SlotPrompts;
  /** Free-text "pain" slots are NOT validated strictly — collect as gold. */
  readonly freeText?: boolean;
}

// ---------------------------------------------------------------------------
// Common Zod fragments.
// ---------------------------------------------------------------------------

const nonEmptyString = z.string().trim().min(1);
const phoneE164 = z.string().regex(/^\+?[1-9]\d{6,14}$/, 'phone must be E.164-ish');
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().min(0);

// ---------------------------------------------------------------------------
// The slot bank.
//   Add slots here. Order is convention only — info-gain ranker decides
//   which question is asked next.
// ---------------------------------------------------------------------------

export const SLOTS = {
  // 1. Tenant identity (highest prior — required for ANY other write).
  owner_full_name: defineSlot({
    key: 'owner_full_name',
    category: 'tenant_identity',
    schema: nonEmptyString,
    prior: 0.95,
    prompts: {
      'en-KE': "What's your full name as it appears on your national ID?",
      'sw-KE': 'Jina lako kamili kama lilivyo kwenye kitambulisho?',
    },
  }),
  owner_phone: defineSlot({
    key: 'owner_phone',
    category: 'tenant_identity',
    schema: phoneE164,
    prior: 0.95,
    prompts: {
      'en-KE': 'Best phone number to reach you on?',
      'sw-KE': 'Nambari yako bora ya simu?',
    },
  }),
  owner_email: defineSlot({
    key: 'owner_email',
    category: 'tenant_identity',
    schema: z.string().email(),
    prior: 0.7,
    prompts: {
      'en-KE': "What email do you use for property matters?",
    },
  }),
  company_name: defineSlot({
    key: 'company_name',
    category: 'tenant_identity',
    schema: nonEmptyString,
    prior: 0.85,
    prompts: {
      'en-KE': 'What name should we put on your workspace? (your company / your name)',
      'sw-KE': 'Tutaita workspace yako jina gani?',
    },
  }),
  owner_kra_pin: defineSlot({
    key: 'owner_kra_pin',
    category: 'tenant_identity',
    schema: z.string().regex(/^[AP]\d{9}[A-Z]$/i, 'KRA PIN format Annnnnnnnnx'),
    prior: 0.4,
    prompts: {
      'en-KE': 'Your KRA PIN (for tax-compliant receipts)?',
    },
  }),
  preferred_language: defineSlot({
    key: 'preferred_language',
    category: 'tenant_identity',
    schema: z.enum(['en-KE', 'sw-KE', 'lg-UG', 'ha-NG']),
    prior: 0.9,
    prompts: {
      'en-KE': 'Which language do you prefer me to speak? English, Swahili, Luganda, or Hausa?',
      'sw-KE': 'Lugha gani unataka tutumie?',
    },
  }),

  // 2. Portfolio.
  portfolio_property_count: defineSlot({
    key: 'portfolio_property_count',
    category: 'portfolio',
    schema: positiveInt,
    prior: 0.9,
    prompts: {
      'en-KE': 'How many buildings / properties do you manage in total?',
      'sw-KE': 'Una majengo / properties ngapi kwa jumla?',
    },
  }),
  portfolio_property_names: defineSlot({
    key: 'portfolio_property_names',
    category: 'portfolio',
    schema: z.array(nonEmptyString).min(1),
    prior: 0.88,
    dependsOn: ['portfolio_property_count'],
    prompts: {
      'en-KE': 'What do you call each property? List them.',
      'sw-KE': 'Unaita kila property jina gani?',
    },
  }),
  portfolio_locations: defineSlot({
    key: 'portfolio_locations',
    category: 'portfolio',
    schema: z.array(nonEmptyString).min(1),
    prior: 0.7,
    dependsOn: ['portfolio_property_names'],
    prompts: {
      'en-KE': 'Where (neighbourhood / town) is each property?',
    },
  }),
  portfolio_building_types: defineSlot({
    key: 'portfolio_building_types',
    category: 'portfolio',
    schema: z.array(z.enum(['apartments', 'bedsitters', 'maisonettes', 'commercial', 'mixed', 'standalone_house', 'gated_community', 'other'])).min(1),
    prior: 0.65,
    dependsOn: ['portfolio_property_names'],
    prompts: {
      'en-KE': 'What type is each (apartments, bedsitters, maisonettes, commercial)?',
    },
  }),
  portfolio_unit_count_total: defineSlot({
    key: 'portfolio_unit_count_total',
    category: 'portfolio',
    schema: positiveInt,
    prior: 0.85,
    prompts: {
      'en-KE': 'How many rentable units across all properties (rough number is fine)?',
    },
  }),
  portfolio_unit_types: defineSlot({
    key: 'portfolio_unit_types',
    category: 'portfolio',
    schema: z.array(z.enum(['single_room', 'bedsitter', '1br', '2br', '3br', '4br_plus', 'commercial', 'other'])).min(1),
    prior: 0.6,
    dependsOn: ['portfolio_unit_count_total'],
    prompts: {
      'en-KE': 'What unit types? (single room / bedsitter / 1BR / 2BR / 3BR ...)',
    },
  }),
  portfolio_rent_range: defineSlot({
    key: 'portfolio_rent_range',
    category: 'portfolio',
    schema: z.object({
      min: nonNegativeInt,
      max: nonNegativeInt,
      currency: currencyCode,
    }).refine((v) => v.max >= v.min, 'max must be >= min'),
    prior: 0.7,
    dependsOn: ['portfolio_unit_types'],
    prompts: {
      'en-KE': 'What rent range across your units? (lowest – highest, in your currency)',
      'sw-KE': 'Kodi ya chini mpaka ya juu ni ngapi?',
    },
  }),
  portfolio_occupancy_pct: defineSlot({
    key: 'portfolio_occupancy_pct',
    category: 'portfolio',
    schema: z.number().min(0).max(100),
    prior: 0.5,
    prompts: {
      'en-KE': 'Roughly what % of your units are occupied today?',
    },
  }),

  // 3. Team.
  team_size: defineSlot({
    key: 'team_size',
    category: 'team',
    schema: nonNegativeInt,
    prior: 0.55,
    prompts: {
      'en-KE': 'How many people help you (managers, caretakers, accountants)?',
    },
  }),
  team_managers: defineSlot({
    key: 'team_managers',
    category: 'team',
    schema: z.array(z.object({
      name: nonEmptyString,
      phone: phoneE164,
      role: z.enum(['manager', 'caretaker', 'accountant', 'agent']),
    })),
    prior: 0.7,
    prompts: {
      'en-KE': 'Who collects rent / handles tenants today? (name + phone + role)',
    },
  }),
  team_vendors: defineSlot({
    key: 'team_vendors',
    category: 'team',
    schema: z.array(z.object({
      name: nonEmptyString,
      trade: z.enum(['plumber', 'electrician', 'cleaner', 'security', 'painter', 'fundi', 'other']),
      phone: phoneE164.optional(),
    })),
    prior: 0.4,
    prompts: {
      'en-KE': 'On-call vendors (plumber, electrician, cleaner)? Name + trade + phone (optional).',
    },
  }),
  owners_other: defineSlot({
    key: 'owners_other',
    category: 'team',
    schema: z.array(z.object({
      name: nonEmptyString,
      relation: z.enum(['co_owner', 'family', 'investor', 'sacco']),
      phone: phoneE164.optional(),
    })),
    prior: 0.35,
    prompts: {
      'en-KE': 'Are there other owners or investors I should know about?',
    },
  }),

  // 4. Processes.
  collection_day_of_month: defineSlot({
    key: 'collection_day_of_month',
    category: 'processes',
    schema: z.number().int().min(1).max(31),
    prior: 0.8,
    prompts: {
      'en-KE': 'On what day of the month is rent due?',
      'sw-KE': 'Kodi inalipwa tarehe ngapi ya mwezi?',
    },
  }),
  grace_period_days: defineSlot({
    key: 'grace_period_days',
    category: 'processes',
    schema: z.number().int().min(0).max(31),
    prior: 0.6,
    prompts: {
      'en-KE': 'How many days grace after the due date before late fees?',
    },
  }),
  late_fee_policy: defineSlot({
    key: 'late_fee_policy',
    category: 'processes',
    schema: z.object({
      kind: z.enum(['flat', 'percentage', 'none']),
      amount: z.number().min(0),
    }),
    prior: 0.55,
    dependsOn: ['grace_period_days'],
    prompts: {
      'en-KE': 'What late fee? (flat amount, percentage of rent, or none)',
    },
  }),
  arrears_call_day: defineSlot({
    key: 'arrears_call_day',
    category: 'processes',
    schema: z.number().int().min(1).max(60),
    prior: 0.5,
    prompts: {
      'en-KE': 'After how many overdue days do you personally call/visit?',
    },
  }),
  eviction_policy: defineSlot({
    key: 'eviction_policy',
    category: 'processes',
    schema: z.object({
      notice_days: z.number().int().min(0),
      requires_court: z.boolean(),
      notes: z.string().optional(),
    }),
    prior: 0.4,
    prompts: {
      'en-KE': "What's your eviction approach? (notice days, court or not, anything special)",
    },
  }),
  maintenance_sla_hours: defineSlot({
    key: 'maintenance_sla_hours',
    category: 'processes',
    schema: positiveInt,
    prior: 0.45,
    prompts: {
      'en-KE': 'When a tenant reports a broken pipe / fuse / lock, how fast do you usually fix it (hours)?',
    },
  }),
  maintenance_who_pays: defineSlot({
    key: 'maintenance_who_pays',
    category: 'processes',
    schema: z.enum(['landlord', 'tenant', 'split', 'depends']),
    prior: 0.4,
    prompts: {
      'en-KE': 'Who pays for repairs by default? (you, tenant, split, depends)',
    },
  }),
  deposit_policy: defineSlot({
    key: 'deposit_policy',
    category: 'processes',
    schema: z.object({
      months_required: z.number().min(0),
      refundable: z.boolean(),
    }),
    prior: 0.45,
    prompts: {
      'en-KE': 'Deposit policy? (months required, refundable on exit)',
    },
  }),

  // 5. Tools — money.
  mpesa_paybill: defineSlot({
    key: 'mpesa_paybill',
    category: 'tools_money',
    schema: z.string().regex(/^\d{5,7}$/),
    prior: 0.75,
    prompts: {
      'en-KE': 'M-Pesa paybill number (if you use one)?',
      'sw-KE': 'Paybill yako ya M-Pesa?',
    },
  }),
  mpesa_till: defineSlot({
    key: 'mpesa_till',
    category: 'tools_money',
    schema: z.string().regex(/^\d{5,8}$/),
    prior: 0.55,
    prompts: {
      'en-KE': 'M-Pesa Till / Buy Goods number (if you use one)?',
    },
  }),
  bank_account: defineSlot({
    key: 'bank_account',
    category: 'tools_money',
    schema: z.object({
      bank: nonEmptyString,
      account_number: z.string().regex(/^\d{6,16}$/),
    }),
    prior: 0.4,
    prompts: {
      'en-KE': 'Bank account where you receive rent (bank + account number)?',
    },
  }),
  accountant_contact: defineSlot({
    key: 'accountant_contact',
    category: 'tools_money',
    schema: z.object({
      name: nonEmptyString,
      phone: phoneE164,
    }),
    prior: 0.3,
    prompts: {
      'en-KE': 'Your accountant / bookkeeper contact (if any)?',
    },
  }),

  // 6. Tools — comms.
  whatsapp_groups: defineSlot({
    key: 'whatsapp_groups',
    category: 'tools_comms',
    schema: z.array(z.object({
      name: nonEmptyString,
      purpose: z.enum(['tenants', 'caretakers', 'vendors', 'owners', 'mixed']),
    })),
    prior: 0.5,
    prompts: {
      'en-KE': 'WhatsApp groups you already use to run things? (name + who is in them)',
    },
  }),
  newsletter_channel: defineSlot({
    key: 'newsletter_channel',
    category: 'tools_comms',
    schema: z.enum(['email', 'sms', 'whatsapp_broadcast', 'none']),
    prior: 0.25,
    prompts: {
      'en-KE': 'Do you send tenants regular updates? How?',
    },
  }),

  // 7. Tools — records.
  current_records_format: defineSlot({
    key: 'current_records_format',
    category: 'tools_records',
    schema: z.enum(['excel', 'notebook', 'pdf_files', 'pm_software', 'none', 'mixed']),
    prior: 0.65,
    prompts: {
      'en-KE': 'How do you keep records today? (Excel, notebook, software, mix)',
    },
  }),
  uploads_provided: defineSlot({
    key: 'uploads_provided',
    category: 'tools_records',
    schema: z.array(z.object({
      kind: z.enum(['rent_ledger', 'lease_pdf', 'receipt_photo', 'unit_photo', 'id_photo', 'other']),
      file_handle: nonEmptyString,
    })),
    prior: 0.6,
    prompts: {
      'en-KE': 'You can drop your rent ledger / leases / receipts here and I will read them.',
    },
  }),

  // 8. Compliance.
  county_permit_status: defineSlot({
    key: 'county_permit_status',
    category: 'compliance',
    schema: z.enum(['active', 'pending', 'expired', 'none', 'unsure']),
    prior: 0.4,
    prompts: {
      'en-KE': 'Single Business Permit / county licence — active, pending, or not yet?',
    },
  }),
  kyc_id_uploaded: defineSlot({
    key: 'kyc_id_uploaded',
    category: 'compliance',
    schema: z.object({
      front_handle: nonEmptyString,
      back_handle: nonEmptyString,
      verified: z.boolean(),
    }),
    prior: 0.8,
    prompts: {
      'en-KE': 'Send a photo of your National ID — front and back. Takes 10 seconds.',
      'sw-KE': 'Tuma picha ya kitambulisho chako — mbele na nyuma.',
    },
  }),

  // 9. Pain points (free-text — pure gold for product feedback).
  pain_points_top: defineSlot({
    key: 'pain_points_top',
    category: 'pain_points',
    schema: z.string().min(3),
    prior: 0.6,
    freeText: true,
    prompts: {
      'en-KE': "What's the most painful part of managing your properties right now?",
      'sw-KE': 'Ni kitu gani kinakusumbua sana kwenye usimamizi wa nyumba?',
    },
  }),
  wishes: defineSlot({
    key: 'wishes',
    category: 'pain_points',
    schema: z.string().min(3),
    prior: 0.3,
    freeText: true,
    prompts: {
      'en-KE': 'If I could do one thing for you tonight, what would it be?',
    },
  }),

  // 10. Jurisdiction.
  country_code: defineSlot({
    key: 'country_code',
    category: 'jurisdiction',
    schema: z.string().regex(/^[A-Z]{2}$/),
    prior: 0.9,
    prompts: {
      'en-KE': 'Which country are your properties in? (KE / TZ / UG / NG / other)',
    },
  }),
  currency: defineSlot({
    key: 'currency',
    category: 'jurisdiction',
    schema: currencyCode,
    prior: 0.85,
    dependsOn: ['country_code'],
    prompts: {
      'en-KE': 'Which currency do you collect in?',
    },
  }),
  city_or_county: defineSlot({
    key: 'city_or_county',
    category: 'jurisdiction',
    schema: nonEmptyString,
    prior: 0.5,
    dependsOn: ['country_code'],
    prompts: {
      'en-KE': 'Which county/city is your primary base?',
    },
  }),
} as const satisfies Record<string, SlotDefinition>;

export type SlotKey = keyof typeof SLOTS;

// ---------------------------------------------------------------------------
// SlotState — the JSONB shape persisted in onboarding_sessions.slots.
// ---------------------------------------------------------------------------

export type SlotState = Partial<Record<SlotKey, unknown>>;

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function defineSlot<T>(def: SlotDefinition<T>): SlotDefinition<T> {
  return def;
}

export function listSlots(): readonly SlotDefinition[] {
  return Object.values(SLOTS) as readonly SlotDefinition[];
}

export function getSlot(key: string): SlotDefinition | undefined {
  return (SLOTS as Record<string, SlotDefinition>)[key];
}

export function validateSlotValue(key: string, value: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const slot = getSlot(key);
  if (!slot) return { ok: false, error: `unknown slot: ${key}` };
  const parsed = slot.schema.safeParse(value);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  return { ok: true, value: parsed.data };
}

export function unfilledSlots(state: SlotState): readonly SlotDefinition[] {
  return listSlots().filter((s) => state[s.key as SlotKey] === undefined);
}

export function filledSlots(state: SlotState): readonly SlotDefinition[] {
  return listSlots().filter((s) => state[s.key as SlotKey] !== undefined);
}

export function slotCount(): number {
  return listSlots().length;
}
