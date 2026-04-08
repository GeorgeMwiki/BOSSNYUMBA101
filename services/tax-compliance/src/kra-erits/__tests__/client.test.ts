import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared tax engine before importing the client. The engine file
// itself is produced by a sibling agent and is not required to be present
// during unit tests.
vi.mock('../../engine/tax-calculator.js', () => ({
  calculateMRI: vi.fn(
    ({ grossRent }: { grossRent: number }) => Math.round(grossRent * 0.1),
  ),
}));

import { KraEritsClient, KraEritsError, type FetchLike } from '../client.js';

/**
 * Build a mock fetch that replies sequentially from the given responses
 * list. Each response has a status code and a JSON body.
 */
function mockFetch(
  responses: Array<{ status?: number; body: Record<string, unknown> }>,
): { fn: FetchLike; calls: Array<{ url: string; body: string | undefined }> } {
  const calls: Array<{ url: string; body: string | undefined }> = [];
  let idx = 0;
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, body: init?.body });
    const r = responses[Math.min(idx, responses.length - 1)] ?? { body: {} };
    idx++;
    const status = r.status ?? 200;
    return {
      ok: status < 400,
      status,
      statusText: status === 200 ? 'OK' : 'ERR',
      text: async (): Promise<string> => JSON.stringify(r.body),
    };
  };
  return { fn, calls };
}

const baseConfig = {
  apiUrl: 'https://sandbox.gavaconnect.go.ke/erits',
  username: 'sandbox-user',
  password: 'sandbox-pass',
  clientId: 'bossnyumba-sandbox',
};

describe('KraEritsClient', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('construction', () => {
    it('accepts explicit config and hides password from public config', () => {
      const client = new KraEritsClient(baseConfig, {
        fetchImpl: mockFetch([]).fn,
      });
      const cfg = client.getPublicConfig();
      expect(cfg.apiUrl).toBe(baseConfig.apiUrl);
      expect(cfg.username).toBe('sandbox-user');
      expect(cfg.clientId).toBe('bossnyumba-sandbox');
      expect((cfg as Record<string, unknown>)['password']).toBeUndefined();
    });

    it('reads config from env vars when not passed explicitly', () => {
      vi.stubEnv('KRA_ERITS_API_URL', 'https://env.example.com/erits');
      vi.stubEnv('KRA_ERITS_USERNAME', 'env-user');
      vi.stubEnv('KRA_ERITS_PASSWORD', 'env-pass');
      const client = new KraEritsClient(
        {},
        { fetchImpl: mockFetch([]).fn },
      );
      const cfg = client.getPublicConfig();
      expect(cfg.apiUrl).toBe('https://env.example.com/erits');
      expect(cfg.username).toBe('env-user');
    });

    it('rejects invalid config via Zod', () => {
      expect(
        () =>
          new KraEritsClient(
            { ...baseConfig, apiUrl: 'not-a-url' },
            { fetchImpl: mockFetch([]).fn },
          ),
      ).toThrow();
    });
  });

  describe('submitMRI (happy path)', () => {
    it('authenticates then submits the return and returns ack + mri amount', async () => {
      const { fn, calls } = mockFetch([
        {
          body: {
            access_token: 'test-token',
            token_type: 'Bearer',
            expires_in: 3600,
          },
        },
        {
          body: {
            status: 'ACCEPTED',
            ackNumber: 'GC-ACK-20260408-0001',
            message: 'Return received',
          },
        },
      ]);

      const client = new KraEritsClient(baseConfig, {
        fetchImpl: fn,
        sleep: async () => undefined,
      });

      const result = await client.submitMRI({
        landlordPin: 'A000000001X',
        propertyId: 'prop_abc123',
        grossRent: 50_000,
        period: { month: 3, year: 2026 },
      });

      expect(result.ackNumber).toBe('GC-ACK-20260408-0001');
      expect(result.mriAmount).toBe(5_000); // 10% of 50_000 per mocked engine

      expect(calls).toHaveLength(2);
      expect(calls[0]?.url).toContain('/oauth/token');
      expect(calls[1]?.url).toContain('/mri/returns');
      const submitted = JSON.parse(calls[1]?.body ?? '{}');
      expect(submitted.taxpayerPin).toBe('A000000001X');
      expect(submitted.propertyRef).toBe('prop_abc123');
      expect(submitted.returnPeriod).toBe('2026-03');
      expect(submitted.grossRentalIncome).toBe(50_000);
      expect(submitted.taxPayable).toBe(5_000);
    });

    it('falls back to acknowledgementNumber field in response', async () => {
      const { fn } = mockFetch([
        {
          body: {
            access_token: 'test-token',
            token_type: 'Bearer',
            expires_in: 3600,
          },
        },
        {
          body: {
            status: 'ACCEPTED',
            acknowledgementNumber: 'ALT-ACK-42',
          },
        },
      ]);
      const client = new KraEritsClient(baseConfig, {
        fetchImpl: fn,
        sleep: async () => undefined,
      });
      const result = await client.submitMRI({
        landlordPin: 'A000000001X',
        propertyId: 'prop_xyz',
        grossRent: 20_000,
        period: { month: 1, year: 2026 },
      });
      expect(result.ackNumber).toBe('ALT-ACK-42');
    });

    it('throws KraEritsError when no ack number is returned', async () => {
      const { fn } = mockFetch([
        {
          body: {
            access_token: 'test-token',
            token_type: 'Bearer',
            expires_in: 3600,
          },
        },
        { body: { status: 'ACCEPTED' } },
      ]);
      const client = new KraEritsClient(baseConfig, {
        fetchImpl: fn,
        sleep: async () => undefined,
      });
      await expect(
        client.submitMRI({
          landlordPin: 'A000000001X',
          propertyId: 'prop_xyz',
          grossRent: 20_000,
          period: { month: 1, year: 2026 },
        }),
      ).rejects.toBeInstanceOf(KraEritsError);
    });

    it('validates params via Zod', async () => {
      const { fn } = mockFetch([]);
      const client = new KraEritsClient(baseConfig, {
        fetchImpl: fn,
        sleep: async () => undefined,
      });
      await expect(
        client.submitMRI({
          landlordPin: '',
          propertyId: 'p',
          grossRent: -1,
          period: { month: 13, year: 2026 },
        }),
      ).rejects.toThrow();
    });
  });
});
