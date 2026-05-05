/**
 * Sensor failover — multi-provider routing with health tracking.
 *
 * Sensors are ranked by `priority` (lower wins) and capabilities
 * needed for the current call (vision, thinking, fast, batch). The
 * failover:
 *
 *   1. Picks the highest-priority healthy sensor that satisfies
 *      capability requirements.
 *   2. On failure, marks the sensor unhealthy for `coolDownMs` and
 *      retries on the next-best sensor.
 *   3. If all sensors fail, throws SensorFailoverError.
 *
 * Pure orchestrator. The Sensor implementations are injected by the
 * composition root.
 */

import type { Sensor, SensorCallArgs, SensorCallResult } from './kernel-types.js';

export class SensorFailoverError extends Error {
  constructor(public readonly attempts: ReadonlyArray<{ sensorId: string; error: string }>) {
    super(`all sensors failed: ${attempts.map((a) => `${a.sensorId}=${a.error}`).join('; ')}`);
    this.name = 'SensorFailoverError';
  }
}

export interface SensorFailoverDeps {
  readonly sensors: ReadonlyArray<Sensor>;
  readonly coolDownMs?: number;
  readonly clock?: () => number;
}

export interface SensorRouter {
  call(args: SensorCallArgs, required: ReadonlyArray<Sensor['capabilities'][number]>): Promise<SensorCallResult>;
  health(): ReadonlyArray<{ id: string; healthy: boolean; lastFailureAt: number | null }>;
  resetAll(): void;
}

export function createSensorRouter(deps: SensorFailoverDeps): SensorRouter {
  const coolDownMs = deps.coolDownMs ?? 30_000;
  const clock = deps.clock ?? Date.now;
  const unhealthy = new Map<string, number>(); // sensorId → lastFailureAt

  function eligible(req: ReadonlyArray<Sensor['capabilities'][number]>): Sensor[] {
    const now = clock();
    return [...deps.sensors]
      .filter((s) => req.every((cap) => s.capabilities.includes(cap)))
      .filter((s) => {
        const at = unhealthy.get(s.id);
        return at === undefined || now - at >= coolDownMs;
      })
      .sort((a, b) => a.priority - b.priority);
  }

  return {
    async call(args, required) {
      const candidates = eligible(required);
      if (candidates.length === 0) {
        throw new SensorFailoverError([
          { sensorId: '__none__', error: `no sensor satisfies capabilities=${required.join(',')}` },
        ]);
      }
      const attempts: Array<{ sensorId: string; error: string }> = [];
      for (const sensor of candidates) {
        try {
          const out = await sensor.call(args);
          return out;
        } catch (err) {
          unhealthy.set(sensor.id, clock());
          attempts.push({
            sensorId: sensor.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      throw new SensorFailoverError(attempts);
    },
    health() {
      const now = clock();
      return deps.sensors.map((s) => {
        const at = unhealthy.get(s.id) ?? null;
        const healthy = at === null || now - at >= coolDownMs;
        return { id: s.id, healthy, lastFailureAt: at };
      });
    },
    resetAll() {
      unhealthy.clear();
    },
  };
}
