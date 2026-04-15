/**
 * Prometheus exporter tests.
 */

import { describe, it, expect } from 'vitest';
import {
  PrometheusRegistry,
  renderPrometheus,
  DEFAULT_LATENCY_BUCKETS_MS,
} from './prometheus.js';

describe('renderPrometheus', () => {
  it('renders counter samples', () => {
    const out = renderPrometheus([
      {
        name: 'http_requests_total',
        type: 'counter',
        help: 'Total HTTP requests',
        labels: { method: 'GET', status: '200' },
        value: 42,
      },
    ]);
    expect(out).toContain('# HELP http_requests_total Total HTTP requests');
    expect(out).toContain('# TYPE http_requests_total counter');
    expect(out).toContain(
      'http_requests_total{method="GET",status="200"} 42'
    );
  });

  it('renders histogram with buckets, sum, count', () => {
    const out = renderPrometheus([
      {
        name: 'http_request_duration_ms',
        type: 'histogram',
        labels: { path: '/x' },
        buckets: [
          { le: 100, count: 2 },
          { le: 500, count: 5 },
          { le: '+Inf', count: 7 },
        ],
        sum: 1234,
        count: 7,
      },
    ]);
    expect(out).toContain(
      'http_request_duration_ms_bucket{path="/x",le="100"} 2'
    );
    expect(out).toContain(
      'http_request_duration_ms_bucket{path="/x",le="+Inf"} 7'
    );
    expect(out).toContain('http_request_duration_ms_sum{path="/x"} 1234');
    expect(out).toContain('http_request_duration_ms_count{path="/x"} 7');
  });

  it('escapes label values', () => {
    const out = renderPrometheus([
      {
        name: 'x',
        type: 'gauge',
        labels: { v: 'a"b\\c\nd' },
        value: 1,
      },
    ]);
    expect(out).toContain('v="a\\"b\\\\c\\nd"');
  });
});

describe('PrometheusRegistry', () => {
  it('accumulates counter values across labels', () => {
    const reg = new PrometheusRegistry();
    const c = reg.counter('requests_total', 'Requests');
    c.inc({ route: '/a' });
    c.inc({ route: '/a' }, 3);
    c.inc({ route: '/b' });
    const text = reg.render();
    expect(text).toContain('requests_total{route="/a"} 4');
    expect(text).toContain('requests_total{route="/b"} 1');
  });

  it('records histogram observations into buckets', () => {
    const reg = new PrometheusRegistry();
    const h = reg.histogram(
      'lat_ms',
      undefined,
      DEFAULT_LATENCY_BUCKETS_MS
    );
    h.observe({ route: '/a' }, 3);
    h.observe({ route: '/a' }, 80);
    h.observe({ route: '/a' }, 20000);
    const text = reg.render();
    // The 5ms bucket should have only the first observation
    expect(text).toContain('lat_ms_bucket{route="/a",le="5"} 1');
    // +Inf should equal total count
    expect(text).toContain('lat_ms_bucket{route="/a",le="+Inf"} 3');
    expect(text).toContain('lat_ms_count{route="/a"} 3');
    expect(text).toContain('lat_ms_sum{route="/a"} 20083');
  });

  it('supports gauge set/inc/dec', () => {
    const reg = new PrometheusRegistry();
    const g = reg.gauge('in_flight', 'In-flight requests');
    g.set({}, 0);
    g.inc({});
    g.inc({});
    g.dec({});
    expect(reg.render()).toContain('in_flight 1');
  });
});
