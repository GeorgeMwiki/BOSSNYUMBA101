/**
 * Subprocessor Register — Typed Source of Truth
 *
 * Mirrors `Docs/SUBPROCESSORS.md` and the `subprocessors` database table.
 * Application code (e.g. `packages/ai-copilot/src/llm-provider-gate.ts`)
 * SHOULD import from here so the gate logic is one edit away from the
 * compliance register.
 *
 * Compliance basis: GDPR Art. 28/30, Kenya DPA 2019 §40-42, Tanzania
 * PDPA 2022 Part V.
 */

export type SubprocessorDpaStatus = 'signed' | 'pending' | 'not_applicable';

export interface Subprocessor {
  /** Stable id used as primary key in the `subprocessors` table. */
  id: string;
  /** Subprocessor display name. */
  name: string;
  /** Why we use this subprocessor. */
  purpose: string;
  /** Personal-data categories sent to this subprocessor. */
  dataCategories: readonly string[];
  /** Region of processing (free-form, e.g. "United States", "EU and US regions"). */
  region: string;
  /** DPA execution state. */
  dpaStatus: SubprocessorDpaStatus;
  /** True if any compliance / sovereignty risk requires gating. */
  riskFlag: boolean;
  /** Free-text notes about the risk; surfaced in the public register. */
  riskNotes?: string;
  /**
   * ISO-3166 alpha-2 country codes for tenants whose data MUST NOT be
   * routed to this subprocessor (code-level enforcement).
   */
  disabledForCountries: readonly string[];
}

/**
 * Canonical list of subprocessors. Keep aligned with `Docs/SUBPROCESSORS.md`
 * and the seed migration in `packages/database/`.
 */
export const SUBPROCESSORS: readonly Subprocessor[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    purpose: 'AI copilot (primary LLM)',
    dataCategories: ['tenant_chat_logs', 'document_ocr_text'],
    region: 'United States',
    dpaStatus: 'pending',
    riskFlag: false,
    riskNotes:
      'DPA pending execution — MUST be signed before GA for production tenant data.',
    disabledForCountries: [],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    purpose: 'Secondary LLM / fallback',
    dataCategories: ['tenant_chat_logs', 'document_ocr_text'],
    region: 'United States',
    dpaStatus: 'signed',
    riskFlag: false,
    disabledForCountries: [],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    purpose: 'Tertiary LLM / cost-optimised',
    dataCategories: ['tenant_chat_logs', 'document_ocr_text'],
    region: "People's Republic of China",
    dpaStatus: 'signed',
    riskFlag: true,
    riskNotes:
      'PRC data sovereignty concerns; disabled at code level for Tanzania (TZ) and Kenya (KE) tenants. See packages/ai-copilot/src/llm-provider-gate.ts.',
    disabledForCountries: ['TZ', 'KE'],
  },
  {
    id: 'twilio',
    name: 'Twilio',
    purpose: 'Transactional SMS delivery',
    dataCategories: ['phone_numbers', 'sms_message_bodies'],
    region: 'United States',
    dpaStatus: 'signed',
    riskFlag: false,
    disabledForCountries: [],
  },
  {
    id: 'resend',
    name: 'Resend',
    purpose: 'Transactional email delivery',
    dataCategories: ['email_addresses', 'email_bodies'],
    region: 'United States',
    dpaStatus: 'signed',
    riskFlag: false,
    disabledForCountries: [],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    purpose: 'Managed Postgres, Auth, Storage',
    dataCategories: ['all_pii_at_rest_encrypted'],
    region: 'EU and US regions',
    dpaStatus: 'signed',
    riskFlag: false,
    riskNotes: 'EU region MUST be used for EU tenants to satisfy GDPR data residency.',
    disabledForCountries: [],
  },
] as const;

/**
 * Lookup a subprocessor by id. Returns `undefined` if not found.
 */
export function getSubprocessor(id: string): Subprocessor | undefined {
  return SUBPROCESSORS.find((s) => s.id === id);
}

/**
 * Returns true if the given subprocessor is allowed to receive data from
 * a tenant in the given country.
 */
export function isSubprocessorAllowedForCountry(
  id: string,
  tenantCountry: string,
): boolean {
  const sp = getSubprocessor(id);
  if (!sp) return false;
  const country = String(tenantCountry ?? '').trim().toUpperCase();
  return !sp.disabledForCountries.includes(country);
}

/**
 * Returns the list of subprocessors whose DPA is still pending — these
 * MUST be signed before GA.
 */
export function getPendingDpaSubprocessors(): readonly Subprocessor[] {
  return SUBPROCESSORS.filter((s) => s.dpaStatus === 'pending');
}

/**
 * Returns the list of subprocessors with an active risk flag — useful for
 * compliance dashboards.
 */
export function getRiskFlaggedSubprocessors(): readonly Subprocessor[] {
  return SUBPROCESSORS.filter((s) => s.riskFlag);
}
