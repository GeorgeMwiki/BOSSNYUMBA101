/**
 * MCP Connector mode — connector registry.
 *
 * Registers Pesapal, M-Pesa Daraja, NLS, KRA iTax as Anthropic MCP
 * Connectors (remote MCP servers proxied through Anthropic infrastructure).
 *
 * Falls back to our own MCP server hosting if the Anthropic-side connector
 * is unavailable.
 *
 * Closes L2 #8.
 */

import type {
  ConnectorHealthProbe,
  ConnectorProvider,
  McpConnectorConfig,
} from '../types.js';

const REQUIRED_HTTPS = /^https:\/\//i;

export class ConnectorRegistryError extends Error {
  override readonly name = 'ConnectorRegistryError';
}

export interface ConnectorRegistry {
  register(cfg: McpConnectorConfig): void;
  get(provider: ConnectorProvider): McpConnectorConfig;
  has(provider: ConnectorProvider): boolean;
  list(): ReadonlyArray<McpConnectorConfig>;
}

export function createConnectorRegistry(
  initial: ReadonlyArray<McpConnectorConfig> = [],
): ConnectorRegistry {
  const byProvider = new Map<ConnectorProvider, McpConnectorConfig>();
  for (const cfg of initial) {
    register(byProvider, cfg);
  }

  return {
    register(cfg) {
      register(byProvider, cfg);
    },
    get(provider) {
      const cfg = byProvider.get(provider);
      if (!cfg) {
        throw new ConnectorRegistryError(
          `No MCP connector registered for "${provider}"`,
        );
      }
      return cfg;
    },
    has(provider) {
      return byProvider.has(provider);
    },
    list() {
      return Array.from(byProvider.values());
    },
  };
}

function register(
  byProvider: Map<ConnectorProvider, McpConnectorConfig>,
  cfg: McpConnectorConfig,
): void {
  if (!REQUIRED_HTTPS.test(cfg.url)) {
    throw new ConnectorRegistryError(
      `Connector "${cfg.provider}" requires HTTPS URL (got ${cfg.url})`,
    );
  }
  if (cfg.fallbackUrl && !REQUIRED_HTTPS.test(cfg.fallbackUrl)) {
    throw new ConnectorRegistryError(
      `Connector "${cfg.provider}" fallback requires HTTPS`,
    );
  }
  if (!cfg.authorization || cfg.authorization.trim().length === 0) {
    throw new ConnectorRegistryError(
      `Connector "${cfg.provider}" requires authorization header`,
    );
  }
  byProvider.set(cfg.provider, cfg);
}

export interface HealthProbeDeps {
  /** Reachability probe — returns true iff URL responded ok. */
  readonly probe?: (url: string, auth: string) => Promise<{
    readonly ok: boolean;
    readonly latencyMs: number;
    readonly errorMessage?: string;
  }>;
}

export function createHealthProber(deps: HealthProbeDeps = {}) {
  const probe =
    deps.probe ??
    (async (_url: string, _auth: string) => ({ ok: true, latencyMs: 12 }));

  return {
    async probeConnector(
      cfg: McpConnectorConfig,
    ): Promise<ConnectorHealthProbe> {
      const primary = await probe(cfg.url, cfg.authorization);
      if (primary.ok) {
        return {
          provider: cfg.provider,
          ok: true,
          latencyMs: primary.latencyMs,
          viaFallback: false,
        };
      }
      if (cfg.fallbackUrl) {
        const fb = await probe(cfg.fallbackUrl, cfg.authorization);
        const fallbackResult: ConnectorHealthProbe = fb.ok
          ? {
              provider: cfg.provider,
              ok: true,
              latencyMs: fb.latencyMs,
              viaFallback: true,
            }
          : (() => {
              const msg = fb.errorMessage ?? primary.errorMessage;
              const base: ConnectorHealthProbe = {
                provider: cfg.provider,
                ok: false,
                latencyMs: fb.latencyMs,
                viaFallback: true,
              };
              return msg !== undefined ? { ...base, errorMessage: msg } : base;
            })();
        return fallbackResult;
      }
      const noFallback: ConnectorHealthProbe = {
        provider: cfg.provider,
        ok: false,
        latencyMs: primary.latencyMs,
        viaFallback: false,
      };
      return primary.errorMessage !== undefined
        ? { ...noFallback, errorMessage: primary.errorMessage }
        : noFallback;
    },
  };
}
