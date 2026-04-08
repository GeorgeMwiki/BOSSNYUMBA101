import { describe, it, expect, vi } from 'vitest';
import { TraClient, type TraFetcher } from '../tra/client.js';
import type { TraVatSubmission } from '../tra/types.js';

const validConfig = {
  baseUrl: 'https://sandbox.tra.example/api',
  username: 'tester',
  password: 'secret',
  tin: '123456789',
};

function makeFetcher(
  responses: Array<{
    match: (url: string, init?: { method?: string }) => boolean;
    status?: number;
    ok?: boolean;
    json?: unknown;
    text?: string;
  }>,
): TraFetcher {
  return vi.fn(async (url: string, init) => {
    const match = responses.find((r) => r.match(url, init));
    if (!match) {
      throw new Error(`unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
    }
    const status = match.status ?? 200;
    return {
      ok: match.ok ?? status < 400,
      status,
      statusText: status < 400 ? 'OK' : 'ERR',
      json: async () => match.json,
      text: async () => match.text ?? '',
    };
  }) as TraFetcher;
}

describe('TraClient construction', () => {
  it('throws when baseUrl missing', () => {
    expect(
      () =>
        new TraClient({
          ...validConfig,
          baseUrl: '',
          fetcher: makeFetcher([]),
        }),
    ).toThrow(/baseUrl/);
  });

  it('throws when credentials missing', () => {
    expect(
      () =>
        new TraClient({
          ...validConfig,
          username: '',
          fetcher: makeFetcher([]),
        }),
    ).toThrow(/username\/password\/tin/);
  });

  it('constructs cleanly with valid config and injected fetcher', () => {
    const client = new TraClient({
      ...validConfig,
      fetcher: makeFetcher([]),
    });
    expect(client).toBeInstanceOf(TraClient);
  });

  it('strips trailing slash from baseUrl', async () => {
    const fetcher = makeFetcher([
      {
        match: (url) => url === 'https://sandbox.tra.example/api/auth/token',
        json: {
          token: 'tok-1',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
    ]);
    const client = new TraClient({
      ...validConfig,
      baseUrl: 'https://sandbox.tra.example/api/',
      fetcher,
    });
    await client.authenticate();
    expect(fetcher).toHaveBeenCalledWith(
      'https://sandbox.tra.example/api/auth/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('TraClient.submitVat happy path', () => {
  const submission: TraVatSubmission = {
    tin: '123456789',
    invoiceNumber: 'INV-0001',
    invoiceDate: '2026-04-01T00:00:00.000Z',
    customerName: 'Acme Tenants Ltd',
    currency: 'TZS',
    lineItems: [
      {
        description: 'Commercial rent, April 2026',
        quantity: 1,
        unitPrice: 1_000_000,
        vatRate: 0.18,
        netAmount: 1_000_000,
        vatAmount: 180_000,
        grossAmount: 1_180_000,
      },
    ],
    totalNet: 1_000_000,
    totalVat: 180_000,
    totalGross: 1_180_000,
  };

  it('authenticates then submits and returns parsed receipt', async () => {
    const fetcher = makeFetcher([
      {
        match: (url) => url.endsWith('/auth/token'),
        json: {
          token: 'tok-1',
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
      },
      {
        match: (url, init) =>
          url.endsWith('/vat/submissions') && init?.method === 'POST',
        json: {
          receiptNumber: 'RCPT-42',
          status: 'ACCEPTED',
          submittedAt: '2026-04-08T10:00:00.000Z',
          verificationUrl: 'https://sandbox.tra.example/verify/RCPT-42',
        },
      },
    ]);

    const client = new TraClient({ ...validConfig, fetcher });
    const result = await client.submitVat(submission);
    expect(result.receiptNumber).toBe('RCPT-42');
    expect(result.status).toBe('ACCEPTED');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('surfaces HTTP errors on submission failure', async () => {
    const fetcher = makeFetcher([
      {
        match: (url) => url.endsWith('/auth/token'),
        json: {
          token: 'tok-1',
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
      },
      {
        match: (url) => url.endsWith('/vat/submissions'),
        status: 500,
        ok: false,
        text: 'internal error',
        json: {},
      },
    ]);
    const client = new TraClient({ ...validConfig, fetcher });
    await expect(client.submitVat(submission)).rejects.toThrow(/VAT submission failed/);
  });

  it('queryStatus returns parsed status', async () => {
    const fetcher = makeFetcher([
      {
        match: (url) => url.endsWith('/auth/token'),
        json: {
          token: 'tok-1',
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
      },
      {
        match: (url, init) =>
          url.includes('/vat/submissions/RCPT-42') && init?.method === 'GET',
        json: {
          receiptNumber: 'RCPT-42',
          status: 'ACCEPTED',
          updatedAt: '2026-04-08T10:05:00.000Z',
        },
      },
    ]);
    const client = new TraClient({ ...validConfig, fetcher });
    const status = await client.queryStatus('RCPT-42');
    expect(status.status).toBe('ACCEPTED');
    expect(status.receiptNumber).toBe('RCPT-42');
  });
});
