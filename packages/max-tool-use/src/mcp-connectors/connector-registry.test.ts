import { describe, expect, it } from 'vitest';
import {
  ConnectorRegistryError,
  createConnectorRegistry,
  createHealthProber,
} from './connector-registry.js';
import type { McpConnectorConfig } from '../types.js';

const PESAPAL: McpConnectorConfig = {
  provider: 'pesapal',
  url: 'https://mcp.pesapal.com/v1',
  authorization: 'Bearer test',
  fallbackUrl: 'https://mcp-fallback.example/v1',
};
const MPESA: McpConnectorConfig = {
  provider: 'mpesa-daraja',
  url: 'https://mcp.mpesa.daraja/v1',
  authorization: 'Bearer test',
};
const NLS: McpConnectorConfig = {
  provider: 'nls',
  url: 'https://mcp.nls.example/v1',
  authorization: 'Bearer test',
};
const KRA: McpConnectorConfig = {
  provider: 'kra-itax',
  url: 'https://mcp.kra.itax/v1',
  authorization: 'Bearer test',
};

describe('createConnectorRegistry', () => {
  it('registers and retrieves connectors', () => {
    const r = createConnectorRegistry([PESAPAL]);
    expect(r.has('pesapal')).toBe(true);
    expect(r.get('pesapal').url).toBe(PESAPAL.url);
  });

  it('lists all registered connectors', () => {
    const r = createConnectorRegistry([PESAPAL, MPESA, NLS, KRA]);
    expect(r.list().map((c) => c.provider).sort()).toEqual(
      ['kra-itax', 'mpesa-daraja', 'nls', 'pesapal'].sort(),
    );
  });

  it('throws ConnectorRegistryError for unknown provider', () => {
    const r = createConnectorRegistry([PESAPAL]);
    expect(() => r.get('mpesa-daraja')).toThrow(ConnectorRegistryError);
  });

  it('refuses non-HTTPS URLs', () => {
    expect(() =>
      createConnectorRegistry([
        { ...PESAPAL, url: 'http://insecure.example' },
      ]),
    ).toThrow(/HTTPS/i);
  });

  it('refuses non-HTTPS fallback URLs', () => {
    expect(() =>
      createConnectorRegistry([
        { ...PESAPAL, fallbackUrl: 'http://insecure.example' },
      ]),
    ).toThrow(/HTTPS/i);
  });

  it('refuses empty authorization', () => {
    expect(() =>
      createConnectorRegistry([{ ...PESAPAL, authorization: '   ' }]),
    ).toThrow(/authorization/i);
  });

  it('allows late registration via .register()', () => {
    const r = createConnectorRegistry();
    expect(r.has('pesapal')).toBe(false);
    r.register(PESAPAL);
    expect(r.has('pesapal')).toBe(true);
  });
});

describe('createHealthProber', () => {
  it('returns ok=true when primary URL is healthy', async () => {
    const p = createHealthProber();
    const probe = await p.probeConnector(PESAPAL);
    expect(probe.ok).toBe(true);
    expect(probe.viaFallback).toBe(false);
  });

  it('falls back when primary fails', async () => {
    const p = createHealthProber({
      probe: async (url) =>
        url === PESAPAL.url
          ? { ok: false, latencyMs: 80, errorMessage: 'down' }
          : { ok: true, latencyMs: 30 },
    });
    const probe = await p.probeConnector(PESAPAL);
    expect(probe.ok).toBe(true);
    expect(probe.viaFallback).toBe(true);
  });

  it('reports failure when both primary and fallback fail', async () => {
    const p = createHealthProber({
      probe: async () => ({ ok: false, latencyMs: 200, errorMessage: 'cold' }),
    });
    const probe = await p.probeConnector(PESAPAL);
    expect(probe.ok).toBe(false);
    expect(probe.viaFallback).toBe(true);
    expect(probe.errorMessage).toBe('cold');
  });

  it('reports failure (no fallback)', async () => {
    const p = createHealthProber({
      probe: async () => ({ ok: false, latencyMs: 12, errorMessage: 'gone' }),
    });
    const probe = await p.probeConnector(MPESA); // no fallback
    expect(probe.ok).toBe(false);
    expect(probe.viaFallback).toBe(false);
  });
});
