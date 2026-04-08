/**
 * @bossnyumba/tax-compliance
 *
 * Tax compliance for BOSSNYUMBA: Tanzania Revenue Authority (TRA) VAT and
 * Withholding Tax submission + pure tax calculators for VAT, WHT, and MRI.
 *
 * KRA eTIMS and KRA eRITS are intentionally out of scope of this package and
 * are owned by a separate service.
 */

// Tax calculator engine (pure functions)
export {
  calculateVAT,
  calculateWHT,
  calculateMRI,
  getMriRate,
  TZ_VAT_STANDARD_RATE,
  WHT_RENT_RESIDENT_RATE,
  WHT_RENT_NON_RESIDENT_RATE,
  WHT_SERVICES_RESIDENT_RATE,
  WHT_SERVICES_NON_RESIDENT_RATE,
  MRI_DEFAULT_RATE,
  type VatOptions,
  type VatResult,
  type WhtOptions,
  type WhtResult,
  type WhtCategory,
  type Residency,
  type MriResult,
} from './engine/tax-calculator.js';

// TRA HTTP client
export {
  TraClient,
  type TraClientConfig,
  type TraFetcher,
} from './tra/client.js';

// TRA Zod schemas + inferred types
export {
  TraAuthRequestSchema,
  TraAuthResponseSchema,
  TraVatLineItemSchema,
  TraVatSubmissionSchema,
  TraSubmissionResponseSchema,
  TraStatusQuerySchema,
  TraStatusResponseSchema,
  type TraAuthRequest,
  type TraAuthResponse,
  type TraVatLineItem,
  type TraVatSubmission,
  type TraSubmissionResponse,
  type TraStatusQuery,
  type TraStatusResponse,
} from './tra/types.js';
