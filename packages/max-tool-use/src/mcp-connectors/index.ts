/**
 * MCP Connector mode — public surface.
 *
 * Closes L2 #8.
 */

export {
  createConnectorRegistry,
  createHealthProber,
  ConnectorRegistryError,
  type ConnectorRegistry,
  type HealthProbeDeps,
} from './connector-registry.js';
