/**
 * Tests for the customer-app case-evidence client surface:
 *   - api.cases.uploadEvidence — multipart POST to /cases/:id/evidence
 *   - api.cases.listEvidence   — JSON GET via the api-client
 *
 * The multipart path bypasses the JSON api-client and talks to `fetch`
 * directly (resolving the Supabase bearer itself), so we stub
 * `global.fetch` and the `@/lib/supabase` token accessor. The JSON path
 * goes through `@bossnyumba/api-client`, which we mock to return a
 * `{ data }` envelope.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAccessToken = vi.fn(async () => 'test-token');
const apiGet = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getAccessToken: () => getAccessToken(),
  getSupabase: () => ({ auth: { signOut: async () => undefined } }),
}));

vi.mock('@bossnyumba/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {},
  hasApiClient: () => true,
  getApiClient: () => ({ get: apiGet }),
  initializeApiClient: () => ({
    get: apiGet,
    addRequestInterceptor: () => undefined,
    setAccessToken: () => undefined,
    clearTokens: () => undefined,
  }),
}));

// Import AFTER the mocks are registered so the module picks them up.
import { api } from '../api';

const realFetch = global.fetch;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = 'https://gw.example.com/api/v1';
  getAccessToken.mockResolvedValue('test-token');
  apiGet.mockReset();
});

afterEach(() => {
  global.fetch = realFetch;
  vi.clearAllMocks();
});

function makeFile(name = 'leak.jpg', type = 'image/jpeg'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe('api.cases.uploadEvidence', () => {
  it('POSTs multipart form-data with a bearer and returns the created record', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          id: 'ev-1',
          caseId: 'case-1',
          fileName: 'leak.jpg',
          fileUrl: 'https://storage.example.com/cases/case-1/evidence/ev-1-leak.jpg',
          mimeType: 'image/jpeg',
        },
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await api.cases.uploadEvidence('case-1', makeFile(), {
      caption: 'kitchen leak',
    });

    expect(result.id).toBe('ev-1');
    expect(result.fileUrl).toContain('ev-1-leak.jpg');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://gw.example.com/api/v1/cases/case-1/evidence');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-token',
    );
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('file')).toBeInstanceOf(File);
    expect(JSON.parse(form.get('metadata') as string)).toEqual({
      caption: 'kitchen leak',
    });
  });

  it('url-encodes the case id in the path', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { id: 'ev-2' } }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await api.cases.uploadEvidence('case/with space', makeFile());
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe(
      'https://gw.example.com/api/v1/cases/case%2Fwith%20space/evidence',
    );
  });

  it('throws with the server error message on a non-2xx response', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: { message: 'File too large' } }),
    })) as unknown as typeof fetch;

    await expect(
      api.cases.uploadEvidence('case-1', makeFile()),
    ).rejects.toThrow('File too large');
  });

  it('throws a default message when the error body is not JSON', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => {
        throw new Error('not json');
      },
    })) as unknown as typeof fetch;

    await expect(
      api.cases.uploadEvidence('case-1', makeFile()),
    ).rejects.toThrow('Evidence upload failed');
  });

  it('omits the metadata field when no caption/fileName override is given', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { id: 'ev-3' } }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await api.cases.uploadEvidence('case-1', makeFile());
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get('metadata')).toBeNull();
    expect(form.get('file')).toBeInstanceOf(File);
  });
});

describe('api.cases.listEvidence', () => {
  it('GETs the case evidence list via the api-client', async () => {
    apiGet.mockResolvedValue({
      data: [
        { id: 'ev-1', caseId: 'case-1', fileName: 'a.jpg', fileUrl: 'u1' },
        { id: 'ev-2', caseId: 'case-1', fileName: 'b.jpg', fileUrl: 'u2' },
      ],
    });

    const rows = await api.cases.listEvidence('case-1');
    expect(rows).toHaveLength(2);
    expect(rows[0].fileName).toBe('a.jpg');
    expect(apiGet).toHaveBeenCalledWith('/cases/case-1/evidence');
  });
});
