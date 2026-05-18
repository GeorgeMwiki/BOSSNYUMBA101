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

const DEFAULT_NAME = 'bossnyumba-mcp-nin';
const DEFAULT_VERSION = '0.1.0';

export interface NinServerConfig {
  readonly name?: string;
  readonly version?: string;
  /** Inject an adapter; tests use this to swap in a deterministic mock. */
  readonly adapter?: NinAdapter;
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

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
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
    // eslint-disable-next-line no-console
    console.error('[mcp-server-nin] fatal:', err);
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
