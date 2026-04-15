/**
 * Health check aggregator.
 *
 * Collects health signals from multiple named checks, evaluates them in
 * parallel with per-check timeouts, and produces a single overall status.
 * Mirrors the Kubernetes liveness/readiness semantics: a failing critical
 * check downgrades overall status to unhealthy, a failing non-critical
 * check downgrades to degraded.
 */

export type HealthState = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckOutcome {
  readonly healthy: boolean;
  readonly message?: string;
  readonly details?: Record<string, unknown>;
}

export interface HealthCheck {
  readonly name: string;
  readonly critical: boolean;
  readonly timeoutMs?: number;
  check(): Promise<HealthCheckOutcome>;
}

export interface HealthCheckResult {
  readonly name: string;
  readonly critical: boolean;
  readonly state: HealthState;
  readonly message?: string;
  readonly durationMs: number;
  readonly details?: Record<string, unknown>;
  readonly error?: string;
}

export interface HealthReport {
  readonly state: HealthState;
  readonly checkedAt: string;
  readonly checks: readonly HealthCheckResult[];
}

/**
 * Aggregator that owns a set of registered checks.
 */
export class HealthAggregator {
  private readonly checks = new Map<string, HealthCheck>();

  register(check: HealthCheck): void {
    this.checks.set(check.name, check);
  }

  unregister(name: string): void {
    this.checks.delete(name);
  }

  has(name: string): boolean {
    return this.checks.has(name);
  }

  async run(): Promise<HealthReport> {
    const checks = Array.from(this.checks.values());
    const results = await Promise.all(
      checks.map((c) => this.runOne(c))
    );
    return {
      state: aggregateState(results),
      checkedAt: new Date().toISOString(),
      checks: results,
    };
  }

  private async runOne(check: HealthCheck): Promise<HealthCheckResult> {
    const start = Date.now();
    const timeoutMs = check.timeoutMs ?? 5_000;
    let timer: NodeJS.Timeout | undefined;
    try {
      const outcome = await Promise.race([
        check.check(),
        new Promise<HealthCheckOutcome>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Health check "${check.name}" timed out`)),
            timeoutMs
          );
        }),
      ]);
      return {
        name: check.name,
        critical: check.critical,
        state: outcome.healthy ? 'healthy' : check.critical ? 'unhealthy' : 'degraded',
        message: outcome.message,
        details: outcome.details,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        name: check.name,
        critical: check.critical,
        state: check.critical ? 'unhealthy' : 'degraded',
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function aggregateState(results: readonly HealthCheckResult[]): HealthState {
  if (results.length === 0) return 'unknown';
  let worst: HealthState = 'healthy';
  for (const r of results) {
    if (r.state === 'unhealthy') return 'unhealthy';
    if (r.state === 'degraded' && worst === 'healthy') {
      worst = 'degraded';
    }
    if (r.state === 'unknown' && worst === 'healthy') {
      worst = 'degraded';
    }
  }
  return worst;
}
