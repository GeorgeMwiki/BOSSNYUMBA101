/**
 * @bossnyumba/mcp-server-nin — MCP server entrypoint.
 *
 * Sandboxed MCP server for Nigerian NIN biometric KYC. Wraps the
 * NIMC NIVS (National Identity Verification Service) behind a single
 * `nin.verify_nin` tool. Listens on stdio (Anthropic default MCP
 * transport) for local dev; can be wrapped with an HTTP/SSE
 * transport in production via the api-gateway composition root.
 *
 * Phase E.5.4 ships a deterministic mock adapter; Phase F replaces
 * it with the real NIMC NIVS REST client.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { NIN_TOOLS, findNinTool } from './tools/index.js';
import { MockNinAdapter } from './adapter.js';
import type { NinAdapter, NinTool, ToolDeps } from './types.js';
import { logger } from './logger.js';

const DEFAULT_NAME = 'bossnyumba-mcp-nin';
const DEFAULT_VERSION = '0.1.0';

// CRITICAL #4 — Per-tenant allowlist guard for the NIN MCP server.
//
// Without this, any stdio caller can invoke the production NIMC NIVS
// adapter regardless of which tenant the action is supposedly on
// behalf of. The allowlist is sourced from:
//   1. an explicit `config.allowlist` array (composition root path), OR
//   2. the env var `MCP_TENANT_ALLOWLIST` (JSON `{"nin": ["t1","t2"]}`)
// Missing or empty allowlist defaults to "deny all" for safety in
// production; tests using the in-memory mock can pass an empty array.
//
// Caller MUST include a `tenantId` either:
//   - in the tool args (every NIN tool already has `tenantId` required), OR
//   - in the request `_meta.tenantId` field (MCP request _meta channel)
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

export interface NinServerConfig {
  readonly name?: string;
  readonly version?: string;
  /** Inject an adapter; tests use this to swap in a deterministic mock. */
  readonly adapter?: NinAdapter;
  /**
   * Per-tenant allowlist (CRITICAL #4). When set, only listed tenants
   * may invoke any tool. When unset, falls back to env
   * `MCP_TENANT_ALLOWLIST['nin']`. When BOTH are unset:
   *   - non-production (`NODE_ENV !== 'production'`) → bypass (so
   *     existing dev/test flows keep working)
   *   - production → deny all (fail closed)
   */
  readonly allowlist?: ReadonlyArray<string>;
}

export function createNinServer(config: NinServerConfig = {}): {
  readonly server: Server;
  readonly adapter: NinAdapter;
  readonly tools: ReadonlyArray<NinTool>;
} {
  const adapter = config.adapter ?? new MockNinAdapter();
  const deps: ToolDeps = Object.freeze({ nin: adapter });

  const server = new Server(
    {
      name: config.name ?? DEFAULT_NAME,
      version: config.version ?? DEFAULT_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: NIN_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
    })),
  }));

  // Resolved allowlist (constructor-injected wins; otherwise env).
  const allowlist: ReadonlyArray<string> | null =
    config.allowlist ?? readEnvAllowlist('nin') ?? null;

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args, _meta } = request.params;
    const tool = findNinTool(name);
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}. Known tools: ${NIN_TOOLS.map((t) => t.name).join(', ')}`,
          },
        ],
      };
    }

    // CRITICAL-5 — prefer the transport-injected, auth-verified
    // tenantId over caller-supplied args.tenantId. Once the gateway
    // wraps this server with `_meta.verifiedTenantId` from the auth
    // context, args.tenantId becomes informational only. Until then,
    // we accept either source but cross-check them for consistency:
    // if BOTH are present and differ, refuse (spoof attempt).
    const argsObj = (args ?? {}) as Record<string, unknown>;
    const metaVerified = (_meta as { verifiedTenantId?: unknown } | undefined)
      ?.verifiedTenantId;
    const metaTenantId =
      (_meta as { tenantId?: unknown } | undefined)?.tenantId;
    const argsTenantId =
      typeof argsObj.tenantId === 'string' ? argsObj.tenantId : '';
    if (
      typeof metaVerified === 'string' &&
      argsTenantId &&
      metaVerified !== argsTenantId
    ) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'nin: args.tenantId does not match verified _meta.verifiedTenantId',
          },
        ],
      };
    }
    const tenantId =
      typeof metaVerified === 'string' && metaVerified
        ? metaVerified
        : argsTenantId ||
          (typeof metaTenantId === 'string' ? metaTenantId : '');
    if (!tenantId) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'nin: missing tenantId — required in args.tenantId or request._meta.tenantId',
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
            text: `nin: tenant '${tenantId}' is not in the per-tenant allowlist`,
          },
        ],
      };
    }

    try {
      const result = await tool.execute((args ?? {}) as never, deps);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'unknown adapter error';
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `nin error in ${name}: ${message}`,
          },
        ],
      };
    }
  });

  return Object.freeze({
    server,
    adapter,
    tools: NIN_TOOLS,
  });
}

async function main(): Promise<void> {
  const { server } = createNinServer();
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
    logger.error('[mcp-server-nin] fatal', { error: err });
    process.exit(1);
  });
}

export { NIN_TOOLS, findNinTool } from './tools/index.js';
export { MockNinAdapter, NimcNivsAdapter } from './adapter.js';
export type {
  NinAdapter,
  NinTool,
  ToolDeps,
  VerifyNinArgs,
  VerifyNinResult,
} from './types.js';
export { NinAdapterError } from './types.js';
