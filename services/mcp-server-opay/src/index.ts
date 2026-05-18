/**
 * @bossnyumba/mcp-server-opay — MCP server entrypoint.
 *
 * Sandboxed MCP server for OPay (Nigeria's largest mobile-money
 * operator, ~40 % market share). Mirrors the Daraja (M-Pesa) tool
 * grammar so the kernel can stay rail-agnostic. Phase E.5.4 ships a
 * deterministic mock; Phase F wires the real OPay Merchant API.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { OPAY_TOOLS, findOpayTool } from './tools/index.js';
import { MockOpayAdapter } from './adapter.js';
import type { OpayAdapter, OpayTool, ToolDeps } from './types.js';

const DEFAULT_NAME = 'bossnyumba-mcp-opay';
const DEFAULT_VERSION = '0.1.0';

// CRITICAL #4 — Per-tenant allowlist. See mcp-server-nin/src/index.ts.
const ALLOWLIST_ENV_VAR = 'MCP_TENANT_ALLOWLIST';
function readEnvAllowlist(key: string): ReadonlyArray<string> | null {
  const raw = process.env[ALLOWLIST_ENV_VAR];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, ReadonlyArray<string>>;
    const list = parsed?.[key];
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

export interface OpayServerConfig {
  readonly name?: string;
  readonly version?: string;
  readonly adapter?: OpayAdapter;
  /** Per-tenant allowlist (CRITICAL #4). */
  readonly allowlist?: ReadonlyArray<string>;
}

export function createOpayServer(config: OpayServerConfig = {}): {
  readonly server: Server;
  readonly adapter: OpayAdapter;
  readonly tools: ReadonlyArray<OpayTool>;
} {
  const adapter = config.adapter ?? new MockOpayAdapter();
  const deps: ToolDeps = Object.freeze({ opay: adapter });

  const server = new Server(
    {
      name: config.name ?? DEFAULT_NAME,
      version: config.version ?? DEFAULT_VERSION,
    },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: OPAY_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
    })),
  }));

  const allowlist: ReadonlyArray<string> | null =
    config.allowlist ?? readEnvAllowlist('opay') ?? null;

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args, _meta } = request.params;
    const tool = findOpayTool(name);
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}. Known tools: ${OPAY_TOOLS.map((t) => t.name).join(', ')}`,
          },
        ],
      };
    }
    const argsObj = (args ?? {}) as Record<string, unknown>;
    const metaTenantId =
      (_meta as { tenantId?: unknown } | undefined)?.tenantId;
    const tenantId =
      typeof argsObj.tenantId === 'string'
        ? argsObj.tenantId
        : typeof metaTenantId === 'string'
          ? metaTenantId
          : '';
    if (!tenantId) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'opay: missing tenantId — required in args.tenantId or request._meta.tenantId',
          },
        ],
      };
    }
    const allowlistResolved =
      allowlist ??
      (process.env.NODE_ENV === 'production' ? ([] as ReadonlyArray<string>) : null);
    if (allowlistResolved && !allowlistResolved.includes(tenantId)) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `opay: tenant '${tenantId}' is not in the per-tenant allowlist`,
          },
        ],
      };
    }
    try {
      const result = await tool.execute((args ?? {}) as never, deps);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'unknown adapter error';
      return {
        isError: true,
        content: [
          { type: 'text', text: `opay error in ${name}: ${message}` },
        ],
      };
    }
  });

  return Object.freeze({ server, adapter, tools: OPAY_TOOLS });
}

async function main(): Promise<void> {
  const { server } = createOpayServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const shutdown = (): void => process.exit(0);
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

const invokedDirectly = (() => {
  try {
    if (!process.argv[1]) return false;
    const argvUrl = new URL(`file://${process.argv[1]}`).href;
    return import.meta.url === argvUrl;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[mcp-server-opay] fatal:', err);
    process.exit(1);
  });
}

export { OPAY_TOOLS, findOpayTool } from './tools/index.js';
export { MockOpayAdapter, OpayMerchantAdapter } from './adapter.js';
export {
  OpayRealAdapter,
  type OpayEnv,
  type OpayRealAdapterDeps,
  type OpayRealCredentials,
} from './adapter-real.js';
export type {
  OpayAdapter,
  OpayTool,
  ToolDeps,
  InitiatePaymentArgs,
  InitiatePaymentResult,
  VerifyPaymentArgs,
  VerifyPaymentResult,
  CashflowLookupArgs,
  CashflowLookupResult,
  CashflowSample,
} from './types.js';
export { OpayAdapterError } from './types.js';
