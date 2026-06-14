/**
 * documents-upload — multipart POST contract.
 *
 * Live detector for the owner-portal "Upload document" dead-button blocker:
 * the DocumentsPage CTA now calls `uploadDocument`, which must POST a
 * `multipart/form-data` body (NOT JSON — the shared `api` client JSON-stringifies
 * and could never carry the binary) to `/documents/upload` with the bearer
 * token, and must surface a server error as a thrown Error rather than silently
 * resolving (which would make the button look dead again).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { uploadDocument } from '../documents-upload';

const TOKEN = 'test-jwt-token';

beforeEach(() => {
  localStorage.setItem('token', TOKEN);
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function file(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'lease.pdf', {
    type: 'application/pdf',
  });
}

describe('uploadDocument', () => {
  it('POSTs multipart/form-data to /documents/upload with the bearer token', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ success: true, data: { id: 'doc-1', name: 'lease.pdf' } }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await uploadDocument({ file: file(), name: 'lease.pdf' });

    expect(result.id).toBe('doc-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/documents\/upload$/);
    expect(init.method).toBe('POST');
    // Body is FormData — NEVER a JSON string.
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    // Bearer token forwarded; Content-Type left to the browser (boundary).
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('throws the server error message on a non-ok / unsuccessful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'STORAGE_UNAVAILABLE', message: 'Object storage is not configured.' },
          }),
          { status: 503, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(uploadDocument({ file: file() })).rejects.toThrow(
      /Object storage is not configured/,
    );
  });
});
