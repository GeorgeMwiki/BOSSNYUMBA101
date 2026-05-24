/**
 * `@bossnyumba/mcp` — public barrel.
 *
 * Deep Model Context Protocol primitives. The package is composed of seven
 * subsystems, each also exported via a sub-path (`@bossnyumba/mcp/transport`,
 * `/server`, `/client`, `/discovery`, `/domain-servers`, `/auth`).
 *
 * The default barrel re-exports the most commonly-used surface so simple
 * consumers can `import { createMCPServer, createMCPClient } from
 * '@bossnyumba/mcp'` without ceremony.
 */

// Types
export * from './types.js';

// Transports
export {
  createStdioTransport,
  createSSETransport,
  createStreamableHTTPTransport,
  createInMemoryTransportPair,
  type StdioTransportOptions,
  type SSETransportOptions,
  type StreamableHTTPTransportOptions,
  type InMemoryTransportPair,
} from './transport/index.js';
