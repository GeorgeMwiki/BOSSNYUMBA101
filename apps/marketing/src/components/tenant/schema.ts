/**
 * Client-side zod schemas for the marketing tenant signup form.
 *
 * Mirrors `TenantSignupRequestSchema` in
 * `services/api-gateway/src/routes/tenants/signup.hono.ts` exactly,
 * field-for-field. Keeping a parallel client-side copy lets us catch
 * field-level errors before the network hop and surface them inline.
 *
 * The server is still the source of truth: we POST the draft and
 * surface whatever 4xx the server returns if a value squeaks past
 * the client check (e.g. a country code added on the server before
 * marketing redeploys).
 */

import { z } from 'zod';
import {
  TENANT_BUSINESS_KINDS,
  TENANT_COUNTRY_CODES,
  TENANT_CURRENCY_CODES,
  TENANT_LANGUAGE_CODES,
} from './types';

const PhoneE164 = z
  .string()
  .min(8)
  .max(20)
  .regex(/^\+?[1-9][0-9]{6,19}$/u, 'phone must be E.164');

const Email = z.string().email().max(254);

const IndividualTenantSchema = z.object({
  kind: z.literal('individual'),
  country: z.enum(TENANT_COUNTRY_CODES),
  fullName: z.string().min(2).max(120),
  phoneE164: PhoneE164,
  email: Email,
  preferredCurrency: z.enum(TENANT_CURRENCY_CODES),
  preferredLanguage: z.enum(TENANT_LANGUAGE_CODES),
  nationalIdNumber: z.string().min(1).max(64).optional(),
});

const CorporateTenantSchema = z.object({
  kind: z.literal('business'),
  country: z.enum(TENANT_COUNTRY_CODES),
  orgName: z.string().min(2).max(160),
  businessKind: z.enum(TENANT_BUSINESS_KINDS),
  businessRegistrationNumber: z.string().min(1).max(64),
  taxId: z.string().min(1).max(64),
  contactFullName: z.string().min(2).max(120),
  contactPhoneE164: PhoneE164,
  contactEmail: Email,
  preferredCurrency: z.enum(TENANT_CURRENCY_CODES),
  preferredLanguage: z.enum(TENANT_LANGUAGE_CODES),
});

export const TenantSignupSchema = z.discriminatedUnion('kind', [
  IndividualTenantSchema,
  CorporateTenantSchema,
]);
export type TenantSignupInput = z.infer<typeof TenantSignupSchema>;

/**
 * Drop a `nationalIdNumber` field when it's an empty string so the
 * server's `.optional()` accepts the absence rather than trying to
 * validate an empty value.
 */
export function compactIndividual<T extends { nationalIdNumber?: string }>(
  draft: T,
): T {
  if (draft.nationalIdNumber !== undefined && draft.nationalIdNumber.trim() === '') {
    const { nationalIdNumber: _omit, ...rest } = draft;
    return rest as T;
  }
  return draft;
}
