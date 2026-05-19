/**
 * Anti-Scheming Dashboard view-model types.
 *
 * Surfaces N-F signals to internal admins via N-A capability cards
 * and a dedicated `/anti-scheming` tab in K-G tab-view.
 *
 * View-models are PURE: no SQL, no fetch. Adapters in the host app
 * convert audit JSON / database rows into these shapes.
 */

export interface TenantSchemingSnapshot {
  readonly tenant_id: string;
  readonly tenant_name: string;
  readonly probe_pass_rate_24h: number;
  readonly auditor_pass_rate_24h: number;
  readonly auditor_regression_pp_24h: number | null;
  readonly self_correction_triggers_24h: number;
  readonly sleeper_flags_24h: number;
  readonly behaviour_delta_pp_24h: number;
  readonly autonomy_level: string;
  readonly status: 'green' | 'amber' | 'red';
}

export interface PlatformSchemingSnapshot {
  readonly generated_at: string;
  readonly tenants_total: number;
  readonly tenants_green: number;
  readonly tenants_amber: number;
  readonly tenants_red: number;
  readonly platform_auditor_pass_rate: number;
  readonly platform_probe_pass_rate: number;
  readonly platform_sleeper_flags_24h: number;
  readonly trend_90d: ReadonlyArray<{ readonly day: string; readonly pass_rate: number }>;
}

export interface CapabilityCardProps {
  readonly tenant: TenantSchemingSnapshot;
  readonly footnote: string;
}
