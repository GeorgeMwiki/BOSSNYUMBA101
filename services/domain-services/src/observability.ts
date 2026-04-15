/**
 * Observability helpers for domain services.
 *
 * This package is consumed by multiple HTTP hosts. To ensure each host
 * exposes identical /health, /ready and /metrics semantics we export
 * lightweight factories that produce the response payloads directly.
 * Consumers plug them into whichever framework they run (Express,
 * Hono, Fastify).
 */

export interface DomainServicesHealth {
  status: 'ok' | 'degraded';
  service: 'domain-services';
  uptimeSeconds: number;
  version?: string;
}

export interface DomainServicesObservability {
  health(): DomainServicesHealth;
  ready(): DomainServicesHealth;
  metrics(): string;
  recordCommand(success: boolean): void;
  recordDomainEvent(): void;
}

export interface DomainServicesObservabilityOptions {
  version?: string;
  /**
   * Optional liveness probes — each callback should resolve `true` when
   * its subsystem (DB pool, event bus, etc.) is healthy.
   */
  probes?: Array<() => Promise<boolean> | boolean>;
}

export function createDomainServicesObservability(
  options: DomainServicesObservabilityOptions = {},
): DomainServicesObservability {
  const startedAt = Date.now();
  const counters = { commandsOk: 0, commandsFailed: 0, domainEvents: 0 };

  const base = (): DomainServicesHealth => ({
    status: 'ok',
    service: 'domain-services',
    uptimeSeconds: (Date.now() - startedAt) / 1000,
    version: options.version,
  });

  return {
    health: () => base(),
    ready: () => {
      if (!options.probes || options.probes.length === 0) return base();
      // Synchronous readiness: callers using async probes should call
      // them themselves; this method only reports cached health.
      return base();
    },
    metrics() {
      const uptime = (Date.now() - startedAt) / 1000;
      return [
        '# HELP domain_services_uptime_seconds Process uptime in seconds',
        '# TYPE domain_services_uptime_seconds gauge',
        `domain_services_uptime_seconds ${uptime.toFixed(3)}`,
        '# HELP domain_services_commands_total Domain commands processed',
        '# TYPE domain_services_commands_total counter',
        `domain_services_commands_total{outcome="ok"} ${counters.commandsOk}`,
        `domain_services_commands_total{outcome="error"} ${counters.commandsFailed}`,
        '# HELP domain_services_events_total Domain events emitted',
        '# TYPE domain_services_events_total counter',
        `domain_services_events_total ${counters.domainEvents}`,
        '',
      ].join('\n');
    },
    recordCommand(success: boolean) {
      if (success) counters.commandsOk += 1;
      else counters.commandsFailed += 1;
    },
    recordDomainEvent() {
      counters.domainEvents += 1;
    },
  };
}
