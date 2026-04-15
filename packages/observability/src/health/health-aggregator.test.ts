import { describe, it, expect } from 'vitest';
import { HealthAggregator } from './health-aggregator.js';

describe('HealthAggregator', () => {
  it('reports healthy when all checks pass', async () => {
    const agg = new HealthAggregator();
    agg.register({
      name: 'db',
      critical: true,
      check: async () => ({ healthy: true }),
    });
    agg.register({
      name: 'cache',
      critical: false,
      check: async () => ({ healthy: true }),
    });
    const report = await agg.run();
    expect(report.state).toBe('healthy');
    expect(report.checks).toHaveLength(2);
  });

  it('reports unhealthy when a critical check fails', async () => {
    const agg = new HealthAggregator();
    agg.register({
      name: 'db',
      critical: true,
      check: async () => ({ healthy: false, message: 'down' }),
    });
    const report = await agg.run();
    expect(report.state).toBe('unhealthy');
    expect(report.checks[0].state).toBe('unhealthy');
  });

  it('reports degraded when only non-critical check fails', async () => {
    const agg = new HealthAggregator();
    agg.register({
      name: 'db',
      critical: true,
      check: async () => ({ healthy: true }),
    });
    agg.register({
      name: 'cache',
      critical: false,
      check: async () => ({ healthy: false }),
    });
    const report = await agg.run();
    expect(report.state).toBe('degraded');
  });

  it('treats a hanging check as unhealthy if critical (via timeout)', async () => {
    const agg = new HealthAggregator();
    agg.register({
      name: 'slow',
      critical: true,
      timeoutMs: 20,
      check: () => new Promise(() => {}),
    });
    const report = await agg.run();
    expect(report.state).toBe('unhealthy');
    expect(report.checks[0].error).toContain('timed out');
  });

  it('reports unknown when no checks are registered', async () => {
    const agg = new HealthAggregator();
    const report = await agg.run();
    expect(report.state).toBe('unknown');
  });
});
