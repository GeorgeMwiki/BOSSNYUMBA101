/**
 * Tests for the DocumentsPage <-> api-client wiring.
 *
 * Exercises the customer-facing `documents` facade that DocumentsPage
 * calls: tenant-scoped list, multipart upload with progress events,
 * and signed download URL resolution.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CLIENT_MODULE = '../../../../../packages/api-client/src/client';

type Handler = (path: string, params?: unknown) => Promise<unknown>;

interface FakeClient {
  get: Handler;
  post: Handler;
  put: Handler;
  patch: Handler;
  delete: Handler;
  getAccessToken: () => string | undefined;
}

const clientState: { current: FakeClient | null } = { current: null };

vi.mock(CLIENT_MODULE, async () => {
  const actual = await vi.importActual<
    typeof import('../../../../../packages/api-client/src/client')
  >(CLIENT_MODULE);
  return {
    ...actual,
    getApiClient: () => {
      if (!clientState.current) {
        throw new Error('fake client not initialised');
      }
      return clientState.current as unknown as ReturnType<typeof actual.getApiClient>;
    },
  };
});

import { documents } from '../../../../../packages/api-client/src/services/documents';

function installFakeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  const base: FakeClient = {
    get: vi.fn(async () => ({ success: true, data: [] })),
    post: vi.fn(async () => ({ success: true, data: null })),
    put: vi.fn(async () => ({ success: true, data: null })),
    patch: vi.fn(async () => ({ success: true, data: null })),
    delete: vi.fn(async () => ({ success: true, data: null })),
    getAccessToken: () => 'test-token',
    ...overrides,
  };
  clientState.current = base;
  return base;
}

// ---------------------------------------------------------------------------
// XMLHttpRequest mock for the upload happy path
// ---------------------------------------------------------------------------

interface FakeXhrConfig {
  status: number;
  responseText: string;
  shouldError?: boolean;
}

function installFakeXhr(config: FakeXhrConfig) {
  class FakeXHR {
    public upload = {
      _handlers: {} as Record<string, (event: ProgressEvent) => void>,
      addEventListener(event: string, handler: (event: ProgressEvent) => void) {
        this._handlers[event] = handler;
      },
    };
    public status = 0;
    public responseText = '';
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public onabort: (() => void) | null = null;
    public sentBody: unknown = null;

    open(_method: string, _url: string, _async: boolean) {
      // no-op
    }
    setRequestHeader(_key: string, _value: string) {
      // no-op
    }
    send(body: unknown) {
      this.sentBody = body;
      // Fire a synthetic progress event so the progress callback runs
      queueMicrotask(() => {
        const handler = this.upload._handlers['progress'];
        if (handler) {
          handler({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
          handler({ lengthComputable: true, loaded: 100, total: 100 } as ProgressEvent);
        }
        if (config.shouldError) {
          this.onerror?.();
          return;
        }
        this.status = config.status;
        this.responseText = config.responseText;
        this.onload?.();
      });
    }
  }

  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = FakeXHR;
  return FakeXHR;
}

describe('DocumentsPage api-client wiring', () => {
  beforeEach(() => {
    installFakeClient();
    // minimal FormData polyfill for Node
    if (typeof (globalThis as { FormData?: unknown }).FormData === 'undefined') {
      class FakeFormData {
        private entries: Array<[string, unknown]> = [];
        append(key: string, value: unknown) {
          this.entries.push([key, value]);
        }
        get(key: string) {
          return this.entries.find(([k]) => k === key)?.[1];
        }
      }
      (globalThis as { FormData?: unknown }).FormData = FakeFormData;
    }
  });

  afterEach(() => {
    delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  });

  describe('listDocuments', () => {
    it('calls GET /documents with the tenantId in query params', async () => {
      const fake = installFakeClient({
        get: vi.fn(async () => ({
          success: true,
          data: [
            {
              id: 'doc-1',
              tenantId: 'tenant-a',
              type: 'LEASE',
              name: 'Lease.pdf',
              mimeType: 'application/pdf',
              size: 1024,
              url: 'https://example.test/doc-1',
              verificationStatus: 'VERIFIED',
              tags: [],
              createdAt: '2026-04-01T00:00:00.000Z',
              createdBy: 'system',
              updatedAt: '2026-04-01T00:00:00.000Z',
              updatedBy: 'system',
            },
          ],
        })),
      });

      const res = await documents.listDocuments({ tenantId: 'tenant-a' });

      expect(fake.get).toHaveBeenCalledTimes(1);
      const [path, params] = (fake.get as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(path).toBe('/documents');
      expect(params).toMatchObject({ tenantId: 'tenant-a' });
      expect(res.data).toHaveLength(1);
    });

    it('surfaces list errors', async () => {
      installFakeClient({
        get: vi.fn(async () => {
          throw new Error('forbidden');
        }),
      });
      await expect(
        documents.listDocuments({ tenantId: 'tenant-a' })
      ).rejects.toThrow('forbidden');
    });
  });

  describe('uploadDocument', () => {
    it('reports progress and resolves with the created document', async () => {
      installFakeXhr({
        status: 201,
        responseText: JSON.stringify({
          success: true,
          data: {
            id: 'doc-new',
            tenantId: 'tenant-a',
            type: 'ID_DOCUMENT',
            name: 'id.png',
            mimeType: 'image/png',
            size: 2048,
            url: 'https://example.test/doc-new',
            verificationStatus: 'PENDING',
            tags: [],
            createdAt: '2026-04-08T00:00:00.000Z',
            createdBy: 'user-1',
            updatedAt: '2026-04-08T00:00:00.000Z',
            updatedBy: 'user-1',
          },
        }),
      });

      const progress: number[] = [];
      const file = { name: 'id.png', size: 100 } as unknown as File;

      const res = await documents.uploadDocument({
        file,
        category: 'ID_DOCUMENT',
        filename: 'id.png',
        onProgress: ({ percent }) => progress.push(percent),
        baseUrl: 'https://api.test/api/v1',
        token: 'tkn',
      });

      expect(progress).toContain(100);
      expect(res.data?.id).toBe('doc-new');
    });

    it('rejects when the server returns a non-2xx status', async () => {
      installFakeXhr({
        status: 400,
        responseText: JSON.stringify({ error: { message: 'bad category' } }),
      });

      const file = { name: 'x.png', size: 1 } as unknown as File;
      await expect(
        documents.uploadDocument({
          file,
          category: 'ID_DOCUMENT',
          baseUrl: 'https://api.test/api/v1',
          token: 'tkn',
        })
      ).rejects.toThrow(/bad category/);
    });

    it('rejects on network error', async () => {
      installFakeXhr({ status: 0, responseText: '', shouldError: true });
      const file = { name: 'x.png', size: 1 } as unknown as File;
      await expect(
        documents.uploadDocument({
          file,
          category: 'ID_DOCUMENT',
          baseUrl: 'https://api.test/api/v1',
          token: 'tkn',
        })
      ).rejects.toThrow(/network/i);
    });
  });

  describe('getDownloadUrl', () => {
    it('resolves a signed URL for the document id', async () => {
      const fake = installFakeClient({
        get: vi.fn(async () => ({
          success: true,
          data: { url: 'https://example.test/signed', expiresAt: '2026-04-08T01:00:00.000Z' },
        })),
      });

      const res = await documents.getDownloadUrl('doc-42');

      expect(fake.get).toHaveBeenCalledTimes(1);
      const [path] = (fake.get as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(path).toBe('/documents/doc-42/download-url');
      expect(res.data?.url).toBe('https://example.test/signed');
    });

    it('surfaces errors from the download URL endpoint', async () => {
      installFakeClient({
        get: vi.fn(async () => {
          throw new Error('not found');
        }),
      });
      await expect(documents.getDownloadUrl('doc-missing')).rejects.toThrow(
        'not found'
      );
    });
  });
});
