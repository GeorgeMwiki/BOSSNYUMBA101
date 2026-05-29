-- =============================================================================
-- Migration 0291 — Mwikila actions inbox (autonomous-MD acting on behalf,
-- real-estate retailored)
--
-- Every autonomous action lands here. The owner cockpit's
-- "Acting on your behalf" inbox renders the table; one-tap approve or
-- reverse drives the lifecycle.
--
-- action_kind: domain-specific verb identifying the handler.
--   rent.next_month_invoice_draft
--   regulatory.quarterly_filing_prep
--   lease.renewal_reminder_ladder
--   payroll.monthly_batch_prep
--   marketplace.counter_offer_listing
--
-- status lifecycle:
--   proposed             T0/T1: Mr. Mwikila has a draft; owner has not acted.
--   owner_approved       T0/T1: owner approved; Mwikila is executing.
--   owner_denied         T0/T1: owner denied; action will not execute.
--   executed             T2/T3: Mwikila executed; T2 still reversible.
--   reversed             T2: owner reversed within the window.
--   committed            T2/T3: reversal window passed; final.
--   blocked_by_inviolable inviolable rail blocked the action; no-op.
--   expired              T0/T1: owner did not act within proposal_ttl.
--
-- Tenant scope:
--   RLS FORCE per CLAUDE.md hard rule.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS mwikila_actions_inbox (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             TEXT NOT NULL,
  acting_on_user_id     TEXT NOT NULL,
  action_kind           TEXT NOT NULL,
  category              TEXT NOT NULL,
  delegation_tier       TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'proposed',
  summary               TEXT NOT NULL,
  summary_sw            TEXT NOT NULL,
  rationale             TEXT NOT NULL,
  payload               JSONB NOT NULL DEFAULT '{}'::jsonb,
  reversal_token        UUID,
  reversal_until        TIMESTAMPTZ,
  proposed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proposal_ttl_at       TIMESTAMPTZ,
  executed_at           TIMESTAMPTZ,
  owner_reviewed_at     TIMESTAMPTZ,
  owner_reviewed_by     TEXT,
  reversed_at           TIMESTAMPTZ,
  committed_at          TIMESTAMPTZ,
  audit_chain_hash      TEXT,
  decision_id           UUID,
  blocked_reason        TEXT,
  provenance            JSONB NOT NULL DEFAULT '{"via":"mwikila"}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT mwikila_actions_inbox_tier_check CHECK (
    delegation_tier IN ('T0', 'T1', 'T2', 'T3')
  ),
  CONSTRAINT mwikila_actions_inbox_status_check CHECK (
    status IN (
      'proposed',
      'owner_approved',
      'owner_denied',
      'executed',
      'reversed',
      'committed',
      'blocked_by_inviolable',
      'expired'
    )
  ),
  CONSTRAINT mwikila_actions_inbox_category_check CHECK (
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
  CONSTRAINT mwikila_actions_inbox_reversal_pair_check CHECK (
    (reversal_token IS NULL AND reversal_until IS NULL) OR
    (reversal_token IS NOT NULL AND reversal_until IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS mwikila_actions_inbox_tenant_status_idx
  ON mwikila_actions_inbox (tenant_id, status, proposed_at DESC);

CREATE INDEX IF NOT EXISTS mwikila_actions_inbox_tenant_category_idx
  ON mwikila_actions_inbox (tenant_id, category, proposed_at DESC);

CREATE INDEX IF NOT EXISTS mwikila_actions_inbox_reversal_due_idx
  ON mwikila_actions_inbox (reversal_until)
  WHERE status = 'executed' AND reversal_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS mwikila_actions_inbox_ttl_due_idx
  ON mwikila_actions_inbox (proposal_ttl_at)
  WHERE status = 'proposed' AND proposal_ttl_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mwikila_actions_inbox_reversal_token_unique
  ON mwikila_actions_inbox (reversal_token)
  WHERE reversal_token IS NOT NULL;

ALTER TABLE mwikila_actions_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE mwikila_actions_inbox FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mwikila_actions_inbox_tenant_isolation
  ON mwikila_actions_inbox;

CREATE POLICY mwikila_actions_inbox_tenant_isolation
  ON mwikila_actions_inbox
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

COMMENT ON TABLE mwikila_actions_inbox IS
  'Mr. Mwikila autonomous-MD actions inbox. Every proposal / execution / '
  'reversal lands here. Owner portal "Acting on your behalf" page renders '
  'this table with one-tap approve / deny / reverse + reversal-window countdown.';

COMMIT;
