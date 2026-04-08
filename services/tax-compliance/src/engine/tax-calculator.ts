/**
 * Tax calculator engine for BOSSNYUMBA.
 *
 * Pure functions (no I/O) so they are trivial to unit-test and to reuse from
 * invoicing, payouts, and reporting pipelines.
 *
 * Supported calculations:
 *   - VAT (Tanzania Revenue Authority, 18% standard rate on commercial rent)
 *   - Withholding Tax (rent: 10% resident individual, 15% non-resident)
 *   - Monthly Rental Income (MRI) — defaults to 7.5% (see TAX_RATES_README.md)
 *
 * All amounts are in the caller's currency (typically TZS or KES). The
 * functions round to 2 decimal places at the boundary so downstream ledger
 * code does not accumulate fractional-cent drift.
 */

/** Tanzania standard VAT rate (commercial rent, services). */
export const TZ_VAT_STANDARD_RATE = 0.18;

/** Withholding Tax rates for rent payments. */
export const WHT_RENT_RESIDENT_RATE = 0.1; // 10% — TZ resident individual landlord
export const WHT_RENT_NON_RESIDENT_RATE = 0.15; // 15% — non-resident landlord
/** Withholding Tax rates for professional / management services. */
export const WHT_SERVICES_RESIDENT_RATE = 0.05; // 5% — TZ resident service provider
export const WHT_SERVICES_NON_RESIDENT_RATE = 0.15; // 15% — non-resident service provider

/**
 * Monthly Rental Income default rate.
 *
 * TODO(tax-compliance): disputed rate — reconcile before production.
 *   - Prior analysis A: 10% (KRA legacy rate, pre-2024)
 *   - Prior analysis B: 7.5% (KRA Finance Act 2023, effective 1 Jan 2024
 *     per Kenya Revenue Authority public notice; see also Section 6A of the
 *     Income Tax Act as amended)
 *   Until a tax advisor signs off, we default to 7.5% and allow an env
 *   override (`MRI_RATE_OVERRIDE`) for hot-patching without a redeploy.
 *   See services/tax-compliance/TAX_RATES_README.md for citations.
 */
export const MRI_DEFAULT_RATE = 0.075;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// VAT
// ---------------------------------------------------------------------------

export interface VatOptions {
  /**
   * Override the default VAT rate (0..1). Rarely needed — mostly for testing
   * or for a future reduced rate.
   */
  rate?: number;
  /**
   * Commercial rent is standard-rated (18%). Residential rent is exempt (0%).
   * Callers MUST set this explicitly so residential exemption is never
   * applied by accident.
   */
  isCommercial: boolean;
}

export interface VatResult {
  /** Net amount (excluding VAT). */
  net: number;
  /** VAT portion. */
  vat: number;
  /** Gross amount (net + VAT). */
  gross: number;
}

/**
 * Calculate VAT given a NET amount.
 *
 * Residential rent is treated as exempt (0% VAT) per TRA guidance.
 *
 * @param amount Net amount before VAT, must be >= 0
 * @param opts   Options; `isCommercial` is required
 */
export function calculateVAT(amount: number, opts: VatOptions): VatResult {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`calculateVAT: amount must be a non-negative finite number, got ${amount}`);
  }
  const rate = opts.rate ?? (opts.isCommercial ? TZ_VAT_STANDARD_RATE : 0);
  if (rate < 0 || rate > 1) {
    throw new Error(`calculateVAT: rate must be between 0 and 1, got ${rate}`);
  }
  const net = round2(amount);
  const vat = round2(net * rate);
  const gross = round2(net + vat);
  return { net, vat, gross };
}

// ---------------------------------------------------------------------------
// Withholding Tax
// ---------------------------------------------------------------------------

export type Residency = 'resident' | 'non-resident';
export type WhtCategory = 'rent' | 'services';

export interface WhtOptions {
  residency: Residency;
  category: WhtCategory;
  /** Explicit override, rarely used. */
  rate?: number;
}

export interface WhtResult {
  /** Gross amount before WHT (what the payer owes before deduction). */
  gross: number;
  /** Amount withheld and remitted to the revenue authority. */
  wht: number;
  /** Net amount actually paid out to the recipient. */
  net: number;
}

function resolveWhtRate(opts: WhtOptions): number {
  if (opts.rate !== undefined) return opts.rate;
  if (opts.category === 'rent') {
    return opts.residency === 'resident' ? WHT_RENT_RESIDENT_RATE : WHT_RENT_NON_RESIDENT_RATE;
  }
  // services
  return opts.residency === 'resident'
    ? WHT_SERVICES_RESIDENT_RATE
    : WHT_SERVICES_NON_RESIDENT_RATE;
}

/**
 * Calculate withholding tax for rent or services payments.
 *
 * @param amount Gross amount to be paid (pre-deduction)
 * @param opts   Residency + category
 */
export function calculateWHT(amount: number, opts: WhtOptions): WhtResult {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`calculateWHT: amount must be a non-negative finite number, got ${amount}`);
  }
  const rate = resolveWhtRate(opts);
  if (rate < 0 || rate > 1) {
    throw new Error(`calculateWHT: rate must be between 0 and 1, got ${rate}`);
  }
  const gross = round2(amount);
  const wht = round2(gross * rate);
  const net = round2(gross - wht);
  return { gross, wht, net };
}

// ---------------------------------------------------------------------------
// Monthly Rental Income (MRI)
// ---------------------------------------------------------------------------

export interface MriResult {
  /** Gross rental income received. */
  gross: number;
  /** MRI tax due. */
  mri: number;
  /** Net to landlord after MRI. */
  net: number;
}

/**
 * Resolve the effective MRI rate, honoring the `MRI_RATE_OVERRIDE` env var if
 * set to a parseable decimal. Invalid overrides are silently ignored in favor
 * of the safe default — we do not want a typo in env to crash payouts.
 */
export function getMriRate(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MRI_RATE_OVERRIDE;
  if (raw !== undefined && raw !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }
  return MRI_DEFAULT_RATE;
}

/**
 * Stub MRI calculator. Until the disputed rate is resolved, defaults to 7.5%
 * with env override (`MRI_RATE_OVERRIDE`). See TAX_RATES_README.md.
 *
 * @param amount Gross monthly rental income
 */
export function calculateMRI(amount: number): MriResult {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`calculateMRI: amount must be a non-negative finite number, got ${amount}`);
  }
  const rate = getMriRate();
  const gross = round2(amount);
  const mri = round2(gross * rate);
  const net = round2(gross - mri);
  return { gross, mri, net };
}
