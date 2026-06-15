/**
 * PORT-SHIM — @bossnyumba/compliance-pack (the renamed equivalent of the
 * sibling vertical's `jurisdiction-profiles`) does NOT export
 * `JurisdictionProfile`, `RegulatorDefinition`, or `linkRegistryRow`; its API
 * diverged. This local shim provides the minimal types + helper so the TZ
 * launch-beachhead profile builds while this package is dark.
 *
 * RECONCILE at live-wiring: either extend compliance-pack to export these, or
 * re-instantiate the jurisdiction-profile pattern against its real API. SEPARATELY
 * (partition law) the TZ profile carries SIBLING-domain MINING content
 * (mining_royalties, Tumemadini) that must be re-instantiated as real-estate
 * regulators before this profile is wired live.
 */

export interface JurisdictionProfile {
  readonly id: string;
  readonly iso_country: string;
  readonly display_name: string;
  readonly data_protection_laws: readonly string[];
  readonly data_residency_kind: string;
  readonly breach_deadline_hours: number;
  readonly rtbf_cascade_scope: string;
  readonly currency_code: string;
  readonly phone_e164_cc: string;
  readonly phone_e164_pattern: string;
  readonly address_format: {
    readonly lines: readonly string[];
    readonly required: readonly string[];
    readonly postal_code_pattern: string;
  };
  readonly holiday_calendar_key: string;
  readonly working_week: readonly number[];
  readonly timezone_default: string;
  readonly quiet_hours_default: { readonly start: string; readonly end: string };
  // Domain-pack-shaped (tax brackets / royalties differ per vertical) — kept
  // structural in the shim; the precise type lives with the real API.
  readonly tax_matrix: Readonly<Record<string, unknown>>;
  readonly language_pack_codes: readonly string[];
  readonly vertical_profile_codes: readonly string[];
  readonly profile_source_url: string;
  readonly profile_source_title: string;
  readonly profile_source_date: string;
  readonly audit_hash: string;
}

export interface RegulatorDefinition {
  readonly id: string;
  readonly jurisdiction_id: string;
  readonly display_name: string;
  readonly domain: string;
  readonly filing_kinds: readonly Readonly<Record<string, unknown>>[];
  readonly audit_hash: string;
  // Regulators carry varying optional fields (due_pattern, api_endpoint, …) that
  // differ per regulator; kept open in the shim. The precise per-field type lives
  // with the real compliance-pack API — reconcile at live-wiring.
  readonly [key: string]: unknown;
}

/**
 * Deterministic placeholder for the compliance-pack registry-link / audit-hash
 * chain. Stable per (kind, id) so snapshots are reproducible; swapped for the
 * real hash-chained link at live-wiring.
 */
export function linkRegistryRow(row: { readonly kind: string; readonly id: string }): string {
  return `shim:${row.kind}:${row.id}`;
}
