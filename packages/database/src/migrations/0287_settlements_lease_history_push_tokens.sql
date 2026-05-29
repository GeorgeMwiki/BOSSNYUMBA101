-- =============================================================================
-- Migration 0287 — Settlements + Lease history + Device push tokens.
--
-- Ports Borjie 0131 (settlements) + 0139 (device_push_tokens) + the
-- real-estate equivalent of mineral_chain_of_custody (lease_history).
--
--   1. `settlements` — one row per RFA-response sign-move-in.
--      Computes gross / deposit / fee / net via LedgerService.post()
--      (CLAUDE.md hard rule). Tenant-scoped via RLS FORCE.
--
--   2. `lease_history` — real-estate chain-of-custody equivalent.
--      Every state-mutating step on a lease (move_in, payment,
--      repair, complaint, renewal, transfer, move_out) records
--      provenance + actor + timestamp + geo + optional C2PA-signed
--      photo cid.
--
--   3. `device_push_tokens` — bidirectional notification registration
--      table for Expo + FCM + APNS tokens, per (user, app, token).
--      Soft-revoke via revoked_at preserves the audit trail.
--
-- Forward-only. Append-only per CLAUDE.md "Migrations are immutable".
-- Idempotent (IF NOT EXISTS + DO blocks). Safe to re-run.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- §1 — settlements
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settlements (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid          NOT NULL,
  rfa_id                uuid          NOT NULL,
  response_id           uuid          NOT NULL,
  -- Money math: gross = rent * lease_term_months
  -- deposit = optional security-deposit credit at move-in
  -- fee = platform fee (1.5%)
  -- net = gross - deposit - fee, paid to landlord
  gross_amount          numeric(15,2) NOT NULL,
  deposit_amount        numeric(15,2) NOT NULL DEFAULT 0,
  fee_amount            numeric(15,2) NOT NULL,
  net_amount            numeric(15,2) NOT NULL,
  currency_code         text          NOT NULL DEFAULT 'TZS',
  status                text          NOT NULL DEFAULT 'pending',
  -- Ledger journal id from LedgerService.post(). NULL until the ledger
  -- write lands; orchestrator stamps post-CAS.
  ledger_txn_id         text,
  payout_provider       text,
  payout_provider_ref   text,
  idempotency_key       text          NOT NULL,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  completed_at          timestamptz,

  CONSTRAINT settlements_status_chk CHECK (
    status IN ('pending', 'posted', 'paying_out', 'completed', 'failed')
  ),
  CONSTRAINT settlements_currency_chk CHECK (
    currency_code IN ('TZS', 'USD', 'KES', 'UGX', 'NGN', 'EUR', 'ZAR', 'GBP', 'AUD')
  ),
  CONSTRAINT settlements_gross_positive_chk CHECK (gross_amount > 0),
  CONSTRAINT settlements_deposit_nonneg_chk CHECK (deposit_amount >= 0),
  CONSTRAINT settlements_fee_nonneg_chk CHECK (fee_amount >= 0),
  CONSTRAINT settlements_net_positive_chk CHECK (net_amount > 0),
  CONSTRAINT settlements_math_chk CHECK (
    net_amount = gross_amount - deposit_amount - fee_amount
  ),
  CONSTRAINT settlements_unique_response_idem UNIQUE (
    tenant_id, response_id, idempotency_key
  )
);

CREATE INDEX IF NOT EXISTS idx_settlements_tenant_created
  ON settlements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_tenant_rfa
  ON settlements (tenant_id, rfa_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status_paying_out
  ON settlements (status)
  WHERE status = 'paying_out';

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'settlements'
       AND policyname = 'settlements_tenant_isolation'
  ) THEN
    CREATE POLICY settlements_tenant_isolation
      ON settlements
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMENT ON TABLE settlements IS
  'Real-estate settlement record. One row per RFA-response sign-move-in. '
  'Computes gross/deposit/fee/net in primary currency, stamps the '
  'double-entry ledger journal id (LedgerService.post()), and tracks '
  'the M-Pesa B2C / wallet payout to the landlord. Tenant-scoped RLS FORCE.';

-- -----------------------------------------------------------------------------
-- §2 — lease_history (real-estate chain-of-custody)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lease_history (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL,
  lease_id           uuid        NOT NULL,
  step_index         integer     NOT NULL,
  action             text        NOT NULL,
  actor_id           text        NOT NULL,
  actor_role         text        NOT NULL,
  happened_at        timestamptz NOT NULL DEFAULT now(),
  /** Optional C2PA-signed photo content id (S3/IPFS). */
  photo_cid          text,
  /** Geo coordinates at the time of the action. */
  location_lat       numeric(9,6),
  location_lon       numeric(9,6),
  /** Amount in the lease's currency (e.g. rent payment, repair cost). */
  amount             numeric(15,2),
  currency_code      text,
  /** Audit hash for provenance chain. */
  audit_hash         text        NOT NULL,
  /** Previous step's audit hash — forms the chain. */
  prev_audit_hash    text        NOT NULL DEFAULT '',
  /** Free-form provenance jsonb for source-of-truth metadata. */
  provenance         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lease_history_action_chk CHECK (
    action IN (
      'move_in', 'rent_payment', 'repair', 'complaint', 'renewal',
      'transfer', 'move_out', 'inspection', 'arrears_notice',
      'rent_change', 'sublet_grant', 'eviction_notice'
    )
  ),
  CONSTRAINT lease_history_actor_role_chk CHECK (
    actor_role IN ('landlord', 'tenant', 'manager', 'admin', 'system')
  ),
  CONSTRAINT lease_history_uniq_step
    UNIQUE (tenant_id, lease_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_lease_history_tenant_lease
  ON lease_history (tenant_id, lease_id, step_index);
CREATE INDEX IF NOT EXISTS idx_lease_history_action
  ON lease_history (tenant_id, action, happened_at DESC);

ALTER TABLE lease_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_history FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'lease_history'
       AND policyname = 'lease_history_tenant_isolation'
  ) THEN
    CREATE POLICY lease_history_tenant_isolation
      ON lease_history
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMENT ON TABLE lease_history IS
  'Real-estate chain-of-custody table. Every state-mutating step on a '
  'lease (move_in, rent_payment, repair, complaint, renewal, transfer, '
  'move_out, inspection, etc.) is recorded with provenance, actor, '
  'timestamp, optional geo coordinates, and optional C2PA-signed photo '
  'cid. Hash-chained via prev_audit_hash. Tenant-scoped RLS FORCE.';

-- -----------------------------------------------------------------------------
-- §3 — device_push_tokens
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid         NOT NULL,
  user_id           text         NOT NULL,
  platform          text         NOT NULL,
  app               text         NOT NULL,
  expo_push_token   text,
  fcm_token         text,
  apns_token        text,
  installed_at      timestamptz  NOT NULL DEFAULT now(),
  last_seen_at      timestamptz  NOT NULL DEFAULT now(),
  revoked_at        timestamptz,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'device_push_tokens_platform_chk'
  ) THEN
    ALTER TABLE device_push_tokens
      ADD CONSTRAINT device_push_tokens_platform_chk
      CHECK (platform IN ('ios', 'android', 'web'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'device_push_tokens_app_chk'
  ) THEN
    ALTER TABLE device_push_tokens
      ADD CONSTRAINT device_push_tokens_app_chk
      CHECK (app IN (
        'owner-portal', 'admin-portal', 'admin-platform-portal',
        'tenant-portal', 'staff-mobile', 'tenant-mobile',
        'estate-manager-mobile', 'customer-mobile'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'device_push_tokens_at_least_one_chk'
  ) THEN
    ALTER TABLE device_push_tokens
      ADD CONSTRAINT device_push_tokens_at_least_one_chk
      CHECK (
        expo_push_token IS NOT NULL
        OR fcm_token IS NOT NULL
        OR apns_token IS NOT NULL
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS device_push_tokens_user_app_token_uq
  ON device_push_tokens (
    user_id,
    app,
    (COALESCE(expo_push_token, '') || '|' || COALESCE(fcm_token, '') || '|' || COALESCE(apns_token, ''))
  );

CREATE INDEX IF NOT EXISTS device_push_tokens_tenant_user_active_idx
  ON device_push_tokens (tenant_id, user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS device_push_tokens_app_active_idx
  ON device_push_tokens (app)
  WHERE revoked_at IS NULL;

ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_push_tokens FORCE  ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'device_push_tokens'
       AND policyname = 'device_push_tokens_tenant_isolation'
  ) THEN
    CREATE POLICY device_push_tokens_tenant_isolation
      ON device_push_tokens
      FOR ALL
      USING (tenant_id::text = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

COMMENT ON TABLE device_push_tokens IS
  'Bidirectional notification receiver registration. One row per '
  '(user, app, token triple). Soft-revoke via revoked_at preserves '
  'audit trail. Tenant-scoped RLS FORCE.';

COMMIT;
