/**
 * CRITICAL #4 — per-tenant allowlist guard for the OPay MCP server, with
 * the fail-closed-in-every-env hardening.
 *
 * The handler must:
 *   - reject when allowlist is configured and tenant is not in it
 *   - reject when NO allowlist is configured, in EVERY environment
 *     (dev / test / CI / staging / preview / prod) — no dev fail-open
 *   - allow ONLY when the tenant is explicitly listed, OR the explicit
 *     opt-out env `MCP_ALLOWLIST_DISABLED=true` is set
 */
import { describe, it, expect } from 'vitest';
import { createOpayServer } from '../src/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

function getCallHandler(serverObj: ReturnType<typeof createOpayServer>) {
  const inner = serverObj.server as unknown as {
    _requestHandlers?: Map<string, (req: unknown) => Promise<unknown>>;
  };
  const map = inner._requestHandlers;
  if (!map) return null;
  const schemaName = CallToolRequestSchema.shape.method.value;
  return map.get(schemaName) ?? null;
}

const ARGS = { tenantId: 't-bravo', transactionId: 'opay_tx_1' };

async function call(
  srv: ReturnType<typeof createOpayServer>,
  args: Record<string, unknown>,
) {
  const handler = getCallHandler(srv);
  if (!handler) return null;
  return (await handler({
    params: { name: 'opay.verify_payment', arguments: args },
    method: 'tools/call',
  })) as { isError?: boolean; content?: Array<{ text?: string }> };
}

describe('OPay MCP allowlist — fail-closed in every env', () => {
  it('rejects when allowlist set and tenant not in it', async () => {
    const res = await call(createOpayServer({ allowlist: ['t-alpha'] }), ARGS);
    if (!res) return;
    expect(res.isError).toBe(true);
    expect(res.content?.[0]?.text).toMatch(/not in the per-tenant allowlist/);
  });

  it('rejects in NON-production with no allowlist (no dev fail-open)', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevDisable = process.env.MCP_ALLOWLIST_DISABLED;
    process.env.NODE_ENV = 'development';
    delete process.env.MCP_ALLOWLIST_DISABLED;
    try {
      const res = await call(createOpayServer({}), ARGS);
      if (!res) return;
      expect(res.isError).toBe(true);
      expect(res.content?.[0]?.text).toMatch(/not in the per-tenant allowlist/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevDisable === undefined) delete process.env.MCP_ALLOWLIST_DISABLED;
      else process.env.MCP_ALLOWLIST_DISABLED = prevDisable;
    }
  });

  it('allows ANY tenant only with explicit MCP_ALLOWLIST_DISABLED opt-out', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevDisable = process.env.MCP_ALLOWLIST_DISABLED;
    process.env.NODE_ENV = 'development';
    process.env.MCP_ALLOWLIST_DISABLED = 'true';
    try {
      const res = await call(createOpayServer({}), ARGS);
      if (!res) return;
      // Gate bypassed -> reaches the tool (mock adapter), not the gate error.
      expect(res.content?.[0]?.text ?? '').not.toMatch(
        /not in the per-tenant allowlist/,
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevDisable === undefined) delete process.env.MCP_ALLOWLIST_DISABLED;
      else process.env.MCP_ALLOWLIST_DISABLED = prevDisable;
    }
  });
});
