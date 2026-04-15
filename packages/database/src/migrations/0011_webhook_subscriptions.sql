-- BOSSNYUMBA Webhook Subscriptions
-- Persistent store for webhook subscriptions used by services/webhooks.
-- Replaces the in-memory Map when WEBHOOKS_STORE=database.

-- ============================================================================
-- webhook_subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id         UUID PRIMARY KEY,
  tenant_id  UUID NOT NULL,
  url        TEXT NOT NULL,
  events     JSONB NOT NULL,              -- WebhookEventType[]
  secret     TEXT,                         -- nullable HMAC signing secret
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant-scoped lookup of active subscriptions (the hot path for trigger()).
CREATE INDEX IF NOT EXISTS webhook_subscriptions_tenant_active_idx
  ON webhook_subscriptions (tenant_id, active);

-- URL http(s) validation is enforced in application code (see services/webhooks/src/store.ts).
