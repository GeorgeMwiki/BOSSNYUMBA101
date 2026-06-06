/**
 * Logger adapter (BossNyumba wiring)
 *
 * The ported `@/lib/logger` exposed `createLogger(name) => { info, warn, ... }`.
 * BossNyumba's canonical structured logger is `@bossnyumba/observability`'s
 * Pino-backed `Logger` (handles redaction + OTel trace correlation). Its
 * factory takes a full `TelemetryConfig`, so this thin wrapper adapts the
 * name-string surface onto it.
 *
 * Pino only — no `console.log` (per the platform hard rules).
 */

import { createLogger as createObservabilityLogger } from "@bossnyumba/observability";
import { LogLevel } from "@bossnyumba/observability";
import type { Logger } from "@bossnyumba/observability";

type ServiceEnvironment = "production" | "staging" | "development";

function resolveEnvironment(): ServiceEnvironment {
  const env = process.env.NODE_ENV;
  if (env === "production" || env === "staging") return env;
  return "development";
}

/**
 * Create a named structured logger for a truth-engine component.
 *
 * @param name Component name (e.g. "NumericClaimAnchor"), surfaced as the
 *             logger's `service.name` so log lines are filterable per module.
 */
export function createLogger(name: string): Logger {
  return createObservabilityLogger({
    service: {
      name: `truth-engine:${name}`,
      version: "0.1.0",
      environment: resolveEnvironment(),
    },
    enabled: true,
    logLevel:
      (process.env.LOG_LEVEL as LogLevel | undefined) ?? LogLevel.INFO,
    traceSampleRatio: 0,
    metricsIntervalMs: 0,
    consoleExport: process.env.NODE_ENV !== "production",
  });
}
