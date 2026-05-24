/**
 * `@bossnyumba/mcp` — public barrel.
 *
 * Deep Model Context Protocol primitives. The package is composed of
 * subsystems, each also exported via a sub-path
 * (`@bossnyumba/mcp/transport`, `/server`, `/client`, `/discovery`,
 * `/domain-servers`, `/auth`).
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

// Server framework
export {
  createMCPServer,
  type MCPServer,
  type MCPServerConfig,
  type AttachedSession,
  zodToJsonSchema,
} from './server/index.js';

// Client
export {
  createMCPClient,
  type MCPClient,
  type MCPClientOptions,
} from './client/index.js';

// Discovery
export {
  discoverFromConfig,
  namespace,
  unnamespace,
  createToolRouter,
  MCPConfigSchema,
  MCPServerConfigSchema,
  type DiscoveredServer,
  type MCPConfig,
  type MCPServerConfigEntry,
  type ToolRouter,
} from './discovery/index.js';

// Auth
export {
  createOAuthPKCEFlow,
  createBearerAuth,
  createServiceTokenAuth,
  type AuthProvider,
  type OAuthPKCEConfig,
  type OAuthPKCEFlow,
  type PKCEChallenge,
  type ServiceTokenStore,
} from './auth/index.js';
