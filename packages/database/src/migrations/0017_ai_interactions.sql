-- BOSSNYUMBA AI Interactions Log
-- Captures every user-facing AI copilot/chat/briefing invocation
-- for learning, auditing, and cost/quality analytics.

CREATE TABLE IF NOT EXISTS ai_interactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL,
  active_org_id     TEXT,
  user_id           TEXT NOT NULL,
  endpoint          TEXT NOT NULL,             -- e.g. 'copilot.chat' | 'briefing'
  jurisdiction      TEXT,                      -- ISO-2 country code used for gate/policy
  provider          TEXT NOT NULL,             -- 'anthropic' | 'openai' | 'deepseek' | 'mock'
  model             TEXT NOT NULL,             -- resolved model id
  degraded          BOOLEAN NOT NULL DEFAULT FALSE, -- true when fell back to mock
  prompt            TEXT,                      -- user prompt / input
  response          TEXT,                      -- model response
  system_prompt     TEXT,                      -- system prompt used
  conversation      JSONB,                     -- full conversation history (optional)
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  latency_ms        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'success', -- 'success' | 'error'
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_interactions_tenant_id_idx    ON ai_interactions(tenant_id);
CREATE INDEX IF NOT EXISTS ai_interactions_user_id_idx      ON ai_interactions(user_id);
CREATE INDEX IF NOT EXISTS ai_interactions_endpoint_idx     ON ai_interactions(endpoint);
CREATE INDEX IF NOT EXISTS ai_interactions_provider_idx     ON ai_interactions(provider);
CREATE INDEX IF NOT EXISTS ai_interactions_created_at_idx   ON ai_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_interactions_tenant_time_idx  ON ai_interactions(tenant_id, created_at DESC);
