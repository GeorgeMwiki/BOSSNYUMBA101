import { z } from 'zod';

/**
 * KRA eRITS (electronic Rental Income Tax System) types.
 *
 * eRITS is accessed via Gava Connect (https://gavaconnect.go.ke) in the
 * sandbox onboarding phase. Authentication is username/password against a
 * REST endpoint that returns a bearer token; MRI (Monthly Rental Income)
 * returns are posted as JSON to `/mri/returns`.
 */

/** eRITS client configuration. */
export const KraEritsConfigSchema = z.object({
  apiUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  /** Optional Gava Connect client id for OAuth sandbox (falls back to username). */
  clientId: z.string().optional(),
  timeoutMs: z.number().int().positive().default(15_000),
  maxRetries: z.number().int().nonnegative().default(3),
});
export type KraEritsConfig = z.infer<typeof KraEritsConfigSchema>;

/** Monthly period (Gregorian) for an MRI return. */
export const KraEritsPeriodSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2015).max(2100),
});
export type KraEritsPeriod = z.infer<typeof KraEritsPeriodSchema>;

/** Inbound parameters for `submitMRI`. */
export const KraEritsMriParamsSchema = z.object({
  /** Landlord KRA PIN (e.g. A000000000X) */
  landlordPin: z.string().min(1).max(20),
  /** Internal property identifier (BOSSNYUMBA property id) */
  propertyId: z.string().min(1),
  /** Gross rental income collected during the period, in KES */
  grossRent: z.number().nonnegative(),
  period: KraEritsPeriodSchema,
});
export type KraEritsMriParams = z.infer<typeof KraEritsMriParamsSchema>;

/** Result returned by a successful MRI submission. */
export const KraEritsMriResultSchema = z.object({
  /** Gava Connect acknowledgement number */
  ackNumber: z.string(),
  /** Computed MRI tax amount in KES (10% of gross rent under KE law) */
  mriAmount: z.number().nonnegative(),
});
export type KraEritsMriResult = z.infer<typeof KraEritsMriResultSchema>;

/** Token response from Gava Connect `/oauth/token`. */
export const GavaConnectTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string().default('Bearer'),
  expires_in: z.number().int().positive().default(3600),
});
export type GavaConnectToken = z.infer<typeof GavaConnectTokenSchema>;

/** Raw MRI submission response envelope from Gava Connect. */
export const KraEritsSubmitResponseSchema = z.object({
  status: z.string(),
  ackNumber: z.string().optional(),
  acknowledgementNumber: z.string().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});
export type KraEritsSubmitResponse = z.infer<typeof KraEritsSubmitResponseSchema>;
