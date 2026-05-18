/**
 * @bossnyumba/mcp-server-firs — MCP server entrypoint.
 *
 * Sandboxed MCP server for Nigeria's Federal Inland Revenue Service /
 * Nigeria Revenue Service. Wraps VAT filing + TIN verification +
 * payment status behind 3 MCP tools. Phase E.5.4 ships a deterministic
 * mock; Phase F wires the real TaxProMax + NRS Tax ID Portal clients.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { FIRS_TOOLS, findFirsTool } from './tools/index.js';
import { MockFirsAdapter } from './adapter.js';
import type { FirsAdapter, FirsTool, ToolDeps } from './types.js';

const DEFAULT_NAME = 'bossnyumba-mcp-firs';
const DEFAULT_VERSION = '0.1.0';

// CRITICAL #4 — Per-tenant allowlist. See mcp-server-nin/src/index.ts
// for the contract; this file mirrors it.
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

export interface FirsServerConfig {
  readonly name?: string;
  readonly version?: string;
  readonly adapter?: FirsAdapter;
  /** Per-tenant allowlist (CRITICAL #4). See mcp-server-nin for contract. */
  readonly allowlist?: ReadonlyArray<string>;
}

export function createFirsServer(config: FirsServerConfig = {}): {
  readonly server: Server;
  readonly adapter: FirsAdapter;
  readonly tools: ReadonlyArray<FirsTool>;
} {
  const adapter = config.adapter ?? new MockFirsAdapter();
  const deps: ToolDeps = Object.freeze({ firs: adapter });

  const server = new Server(
    {
      name: config.name ?? DEFAULT_NAME,
      version: config.version ?? DEFAULT_VERSION,
    },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: FIRS_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
    })),
  }));

  const allowlist: ReadonlyArray<string> | null =
    config.allowlist ?? readEnvAllowlist('firs') ?? null;

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args, _meta } = request.params;
    const tool = findFirsTool(name);
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}. Known tools: ${FIRS_TOOLS.map((t) => t.name).join(', ')}`,
          },
        ],
      };
    }
    // CRITICAL #4 — per-tenant allowlist guard.
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
            text: 'firs: missing tenantId — required in args.tenantId or request._meta.tenantId',
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
            text: `firs: tenant '${tenantId}' is not in the per-tenant allowlist`,
          },
        ],
      };
    }
    try {
      const result = await tool.execute((args ?? {}) as never, deps);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'unknown adapter error';
      return {
        isError: true,
        content: [{ type: 'text', text: `firs error in ${name}: ${message}` }],
      };
    }
  });

  return Object.freeze({ server, adapter, tools: FIRS_TOOLS });
}

async function main(): Promise<void> {
  const { server } = createFirsServer();
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
    console.error('[mcp-server-firs] fatal:', err);
    process.exit(1);
  });
}

export { FIRS_TOOLS, findFirsTool } from './tools/index.js';
export { MockFirsAdapter, FirsTaxProMaxAdapter } from './adapter.js';
export type {
  FirsAdapter,
  FirsTool,
  ToolDeps,
  FileVatReturnArgs,
  FileVatReturnResult,
  VerifyTinArgs,
  VerifyTinResult,
  GetPaymentStatusArgs,
  GetPaymentStatusResult,
} from './types.js';
export { FirsAdapterError } from './types.js';
