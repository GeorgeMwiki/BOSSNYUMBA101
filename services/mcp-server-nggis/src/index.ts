/**
 * @bossnyumba/mcp-server-nggis — MCP server entrypoint.
 *
 * Sandboxed MCP server for Nigeria's land-registry surface. Fans out
 * to per-state registries (LASRRA, ABGIS, KADGIS, …) behind a single
 * federal-aggregator interface. Phase E.5.4 ships a deterministic
 * mock; Phase F wires the real per-state REST clients.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { NGGIS_TOOLS, findNggisTool } from './tools/index.js';
import { MockNggisAdapter } from './adapter.js';
import type { NggisAdapter, NggisTool, ToolDeps } from './types.js';

const DEFAULT_NAME = 'bossnyumba-mcp-nggis';
const DEFAULT_VERSION = '0.1.0';

export interface NggisServerConfig {
  readonly name?: string;
  readonly version?: string;
  readonly adapter?: NggisAdapter;
}

export function createNggisServer(config: NggisServerConfig = {}): {
  readonly server: Server;
  readonly adapter: NggisAdapter;
  readonly tools: ReadonlyArray<NggisTool>;
} {
  const adapter = config.adapter ?? new MockNggisAdapter();
  const deps: ToolDeps = Object.freeze({ nggis: adapter });

  const server = new Server(
    {
      name: config.name ?? DEFAULT_NAME,
      version: config.version ?? DEFAULT_VERSION,
    },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: NGGIS_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as unknown as Record<string, unknown>,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = findNggisTool(name);
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}. Known tools: ${NGGIS_TOOLS.map((t) => t.name).join(', ')}`,
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
          { type: 'text', text: `nggis error in ${name}: ${message}` },
        ],
      };
    }
  });

  return Object.freeze({ server, adapter, tools: NGGIS_TOOLS });
}

async function main(): Promise<void> {
  const { server } = createNggisServer();
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
    console.error('[mcp-server-nggis] fatal:', err);
    process.exit(1);
  });
}

export { NGGIS_TOOLS, findNggisTool } from './tools/index.js';
export { MockNggisAdapter, NggisFederatedAdapter } from './adapter.js';
export type {
  NggisAdapter,
  NggisTool,
  ToolDeps,
  VerifyTitleDeedArgs,
  VerifyTitleDeedResult,
  SearchPropertyArgs,
  SearchPropertyResult,
  PropertyMatch,
} from './types.js';
export { NggisAdapterError } from './types.js';
