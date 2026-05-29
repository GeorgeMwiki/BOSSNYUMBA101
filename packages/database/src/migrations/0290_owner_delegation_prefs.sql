-- =============================================================================
-- Migration 0290 — Owner delegation preferences (Mwikila autonomous-MD,
-- real-estate retailored)
--
-- Per-owner, per-category delegation tier where:
--
--   T0  inform-only        Mr. Mwikila does not act; informs the owner.
--   T1  propose            Mwikila drafts; owner one-tap approves.
--   T2  act-with-reversal  Mwikila executes; reversal_window_hours
--                           lets the owner reverse via the inbox.
--   T3  irrevocable        Mwikila acts; no reversal. Rare, owner-elevated.
--
-- Real-estate categories (12):
--   rent-scheduling, regulatory-filings, lease-renewals, payroll-prep,
--   listing-counter-offers, maintenance-approvals-low-value,
--   tenant-communications, evictions-initial-notice, capex, inventory,
--   marketplace-listings, contractor-engagement
--
-- The default tier for every category is the safest one — set by the
-- autonomy handler when no row exists. Owners override per-category
-- via PATCH /v1/owner/delegation.
--
-- Tenant scope:
--   RLS FORCE per CLAUDE.md hard rule. tenant GUC bound by api-gateway.
--
-- Envelope guard:
--   `envelope_threshold` is the inviolable cap above which the handler
--   refuses to execute even at T3. Currency tracked in
--   `envelope_threshold_currency` for multi-currency portfolios.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS owner_delegation_prefs (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  TEXT NOT NULL,
  category                   TEXT NOT NULL,
  tier                       TEXT NOT NULL DEFAULT 'T0',
  reversal_window_hours      INTEGER,
  envelope_threshold         NUMERIC(15,2),
  envelope_threshold_currency TEXT NOT NULL DEFAULT 'TZS',
  set_by_user_id             TEXT,
  set_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT owner_delegation_prefs_tier_check CHECK (
    tier IN ('T0', 'T1', 'T2', 'T3')
  ),
  CONSTRAINT owner_delegation_prefs_category_check CHECK (
    category IN (
      'rent-scheduling',
      'regulatory-filings',
      'lease-renewals',
      'payroll-prep',
      'listing-counter-offers',
      'maintenance-approvals-low-value',
      'tenant-communications',
      'evictions-initial-notice',
      'capex',
      'inventory',
      'marketplace-listings',
      'contractor-engagement'
    )
  ),
  CONSTRAINT owner_delegation_prefs_reversal_range CHECK (
    reversal_window_hours IS NULL OR
    (reversal_window_hours BETWEEN 1 AND 168)
  ),
  CONSTRAINT owner_delegation_prefs_envelope_positive CHECK (
    envelope_threshold IS NULL OR envelope_threshold >= 0
  ),
  CONSTRAINT owner_delegation_prefs_currency_check CHECK (
    envelope_threshold_currency ~ '^[A-Z]{3}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS owner_delegation_prefs_tenant_category_unique
  ON owner_delegation_prefs (tenant_id, category);

CREATE INDEX IF NOT EXISTS owner_delegation_prefs_tenant_set_at_idx
  ON owner_delegation_prefs (tenant_id, set_at DESC);

ALTER TABLE owner_delegation_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_delegation_prefs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_delegation_prefs_tenant_isolation
  ON owner_delegation_prefs;

CREATE POLICY owner_delegation_prefs_tenant_isolation
  ON owner_delegation_prefs
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE owner_delegation_prefs IS
  'Per-owner per-category delegation tier for Mr. Mwikila autonomous-MD. '
  'T0=inform / T1=propose / T2=act-with-reversal / T3=irrevocable. '
  'envelope_threshold and reversal_window_hours override defaults.';

COMMIT;
