-- BOSSNYUMBA Subprocessors Migration
-- Creates subprocessors table and seeds the 6 initial subprocessors:
-- Anthropic, OpenAI, DeepSeek, Twilio, Resend, Supabase.
--
-- Mirrors packages/database/src/schemas/subprocessors.schema.ts and the
-- typed source at packages/enterprise-hardening/src/compliance/subprocessors.ts.

-- ============================================================================
-- Enum: subprocessor_dpa_status
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subprocessor_dpa_status') THEN
    CREATE TYPE subprocessor_dpa_status AS ENUM ('signed', 'pending', 'not_applicable');
  END IF;
END$$;

-- ============================================================================
-- Table: subprocessors
-- ============================================================================

CREATE TABLE IF NOT EXISTS subprocessors (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  purpose                 TEXT NOT NULL,
  data_categories         JSONB NOT NULL DEFAULT '[]'::jsonb,
  region                  TEXT NOT NULL,
  dpa_status              subprocessor_dpa_status NOT NULL DEFAULT 'pending',
  risk_flag               BOOLEAN NOT NULL DEFAULT FALSE,
  risk_notes              TEXT,
  disabled_for_countries  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS subprocessors_name_idx       ON subprocessors(name);
CREATE INDEX IF NOT EXISTS subprocessors_dpa_status_idx ON subprocessors(dpa_status);
CREATE INDEX IF NOT EXISTS subprocessors_risk_flag_idx  ON subprocessors(risk_flag);

-- ============================================================================
-- Seed: 6 subprocessors
-- ============================================================================

INSERT INTO subprocessors (
  id, name, purpose, data_categories, region, dpa_status, risk_flag, risk_notes, disabled_for_countries
) VALUES
(
  'anthropic',
  'Anthropic, PBC',
  'AI inference for tenant assistant, lease summarization, and intelligence features (Claude models).',
  '["chat_content","document_text","user_queries","prompt_metadata"]'::jsonb,
  'US',
  'signed',
  TRUE,
  'US-based processor; cross-border transfer requires explicit consent in KE/TZ/ZA/NG.',
  '[]'::jsonb
),
(
  'openai',
  'OpenAI, L.L.C.',
  'Fallback AI inference and embeddings for semantic search.',
  '["chat_content","document_text","user_queries","embeddings"]'::jsonb,
  'US',
  'signed',
  TRUE,
  'US-based processor; requires SCCs for EU and explicit consent for African jurisdictions.',
  '[]'::jsonb
),
(
  'deepseek',
  'DeepSeek',
  'Low-cost AI inference for bulk/background intelligence jobs.',
  '["chat_content","document_text","user_queries"]'::jsonb,
  'CN',
  'pending',
  TRUE,
  'China-based processor. Disabled by default in jurisdictions with strict cross-border transfer controls.',
  '["KE","TZ","ZA","NG","GB","DE","FR","IE"]'::jsonb
),
(
  'twilio',
  'Twilio Inc.',
  'SMS delivery for OTPs, rent reminders, and notifications (including WhatsApp Business API).',
  '["phone_number","message_content","delivery_metadata"]'::jsonb,
  'US',
  'signed',
  FALSE,
  NULL,
  '[]'::jsonb
),
(
  'resend',
  'Resend, Inc.',
  'Transactional email delivery (invoices, statements, receipts, auth emails).',
  '["email_address","email_body","delivery_metadata"]'::jsonb,
  'US',
  'signed',
  FALSE,
  NULL,
  '[]'::jsonb
),
(
  'supabase',
  'Supabase, Inc.',
  'Managed Postgres hosting, object storage, and auth infrastructure.',
  '["all_customer_data","auth_credentials","uploaded_files"]'::jsonb,
  'EU',
  'signed',
  FALSE,
  'Primary data processor. Region pinned to EU / nearest African edge where available.',
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Down (reference)
-- ============================================================================
-- DELETE FROM subprocessors WHERE id IN ('anthropic','openai','deepseek','twilio','resend','supabase');
-- DROP TABLE IF EXISTS subprocessors;
-- DROP TYPE  IF EXISTS subprocessor_dpa_status;
