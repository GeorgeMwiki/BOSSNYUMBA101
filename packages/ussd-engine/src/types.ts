/**
 * USSD engine — type system.
 *
 * Feature-phone ingress for tenants (renters) and property owners. A tenant
 * with no smartphone dials a short code (e.g. *123#) and navigates a bilingual
 * menu tree to check a lease, see this period's rent due, submit a meter
 * reading, hear a maintenance-request status, or browse vacant units in the
 * marketplace. USSD is the single biggest *capability* gap for the
 * low-bandwidth, feature-phone reality of East African housing.
 *
 * USSD constraints (Africa's Talking, the canonical TZ gateway):
 * - 180-second session timeout.
 * - ~182 characters max per screen.
 * - Numeric input only; cumulative `text` is "1*2*3".
 * - Plain text, no encryption — never echo a secret to a USSD screen.
 *
 * Every type is readonly. Producers build new objects; consumers never
 * mutate. There is NO direct DB/SDK/env access in this package — persistence
 * is injected through {@link UssdSessionStore}.
 *
 * @module @bossnyumba/ussd-engine/types
 */

import { z } from 'zod';

// ============================================================================
// Provider + language
// ============================================================================

/** Supported USSD gateway providers. */
export type UssdProvider = 'africas_talking' | 'twilio' | 'infobip';

/**
 * USSD languages. BossNyumba default is `en`; Tanzanian users may toggle to
 * `sw`. The toggle is ABSOLUTE — when a language is active, zero text from
 * the other language appears on any screen (hard rule, CLAUDE.md).
 */
export type UssdLanguage = 'en' | 'sw';

// ============================================================================
// Tier (sender -> tier mapping origin)
// ============================================================================

/**
 * Resolved actor tier for the dialing MSISDN. Mirrors BossNyumba's role-gated
 * model (owner / manager / agent / tenant). `anonymous` is a phone we could
 * not resolve to any tenant member — it still gets a public menu (marketplace
 * browse, generic info) but no tenant-scoped data.
 *
 * Note: `tenant` here is the property-renter role (the person renting a unit),
 * not the multi-tenancy organisation boundary.
 */
export type UssdTier =
  | 'owner'
  | 'manager'
  | 'agent'
  | 'tenant'
  | 'anonymous';

// ============================================================================
// Session state (navigation FSM)
// ============================================================================

/**
 * States in the USSD navigation FSM. Re-skinned to a real-estate flow:
 *   - `lease`           -> active lease + expiry
 *   - `rent`            -> rent due / paid this period
 *   - `meter_reading`   -> submit a utility meter reading (units)
 *   - `maintenance`     -> maintenance-request status
 *   - `marketplace`     -> latest vacant-unit listings
 */
export type UssdSessionState =
  | 'initial'
  | 'main_menu'
  | 'lease'
  | 'lease_detail'
  | 'rent'
  | 'rent_detail'
  | 'meter_reading'
  | 'meter_reading_amount'
  | 'meter_reading_confirm'
  | 'maintenance'
  | 'marketplace'
  | 'marketplace_detail'
  | 'language_switch';

// ============================================================================
// Session
// ============================================================================

/** A USSD session — tracks the dialer's navigation state. Immutable. */
export interface UssdSession {
  readonly sessionId: string;
  /** Dialer MSISDN in E.164 where resolvable. */
  readonly phoneNumber: string;
  /** Resolved tenant (organisation) id, or null for an unresolved caller. */
  readonly tenantId: string | null;
  /** Resolved actor (owner/agent/renter) id, or null. */
  readonly actorId: string | null;
  readonly tier: UssdTier;
  readonly state: UssdSessionState;
  readonly language: UssdLanguage;
  readonly data: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly expiresAt: string;
}

// ============================================================================
// Request / response (Africa's Talking shape)
// ============================================================================

/** Incoming USSD request from the gateway provider. */
export interface UssdRequest {
  readonly sessionId: string;
  readonly serviceCode: string;
  readonly phoneNumber: string;
  /** Cumulative input string, e.g. "" (first dial) or "1*2*3". */
  readonly text: string;
  readonly networkCode?: string;
  readonly provider?: UssdProvider;
}

/** Outgoing USSD response. `isEnd` => terminal screen (gateway hangs up). */
export interface UssdResponse {
  readonly message: string;
  readonly isEnd: boolean;
}

// ============================================================================
// Menu tree
// ============================================================================

/** A single selectable option in a USSD screen. */
export interface UssdMenuOption {
  readonly key: string;
  readonly labelEn: string;
  readonly labelSw: string;
  readonly targetState: UssdSessionState;
  /** Minimum tier required to see this option. Defaults to `anonymous`. */
  readonly minTier?: UssdTier;
}

/** A node in the USSD menu tree. */
export interface UssdMenuNode {
  readonly id: UssdSessionState;
  readonly titleEn: string;
  readonly titleSw: string;
  readonly options: readonly UssdMenuOption[];
  /** Dynamic nodes are built at request time from injected data. */
  readonly isDynamic?: boolean;
}

/** Complete static menu tree. */
export interface UssdMenu {
  readonly root: UssdMenuNode;
  readonly nodes: Readonly<Record<string, UssdMenuNode>>;
}

// ============================================================================
// Dynamic-screen data (provided by the host via data fetchers)
// ============================================================================

/** Active lease summary for a USSD screen. */
export interface UssdLeaseData {
  readonly leaseRef: string;
  readonly statusEn: string;
  readonly statusSw: string;
  /** ISO date string YYYY-MM-DD. */
  readonly expiresOn: string;
  readonly daysToExpiry: number;
}

/** Rent position for the current period. */
export interface UssdRentData {
  readonly periodLabel: string;
  /** Amount in the tenant's primary currency: the host formats with
   *  formatCurrency, we carry the rendered string only. */
  readonly amountDueDisplay: string;
  readonly amountPaidDisplay: string;
  readonly nextActionEn: string;
  readonly nextActionSw: string;
}

/** Maintenance-request status. */
export interface UssdMaintenanceData {
  readonly reference: string;
  readonly statusEn: string;
  readonly statusSw: string;
  readonly summaryDisplay: string;
  readonly nextStepEn: string;
  readonly nextStepSw: string;
}

/** A single vacant-unit listing line for the marketplace screen. */
export interface UssdMarketplaceLine {
  readonly unitEn: string;
  readonly unitSw: string;
  readonly priceDisplay: string;
}

// ============================================================================
// Runtime validation (zod) — boundary guards
// ============================================================================

/** Validates an inbound gateway request at the package boundary. */
export const ussdRequestSchema = z.object({
  sessionId: z.string().min(1),
  serviceCode: z.string().min(1),
  phoneNumber: z.string().min(1),
  text: z.string(),
  networkCode: z.string().optional(),
  provider: z
    .enum(['africas_talking', 'twilio', 'infobip'])
    .optional(),
});

/** Validates a meter-reading unit count submitted via USSD. */
export const meterReadingUnitsSchema = z
  .number()
  .finite()
  .positive();

// ============================================================================
// Constants
// ============================================================================

/** Maximum characters per USSD screen (Africa's Talking). */
export const USSD_MAX_CHARS = 182;

/** Session TTL in seconds (Africa's Talking enforces ~180s). */
export const USSD_SESSION_TIMEOUT_SECONDS = 180;
