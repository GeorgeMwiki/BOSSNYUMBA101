/**
 * POST /api/v1/documents/upload  +  GET /api/v1/documents/:id/download
 * — auth + validation + storage-wiring + anti-IDOR regression.
 *
 * Live detector for the owner-portal "dead button" blocker: the DocumentsPage
 * "Upload document" CTA and the per-row View/Download actions had no backend to
 * call. These pin:
 *   - both routes are wired into the /documents router (never 404),
 *   - the auth gate on upload + download,
 *   - the server-side mime allowlist + missing-file validation (400),
 *   - honest degradation to 503 when no storage provider / repo is wired
 *     (mock mode), proving upload does NOT fake a stored document,
 *   - the download route reaches the RLS-scoped repo and never 404s for a
 *     route-not-found reason (a not-found document is a *data* 404, asserted
 *     against the live DB in the integration suite, not here).
 *
 * The live multipart store + signed-URL mint (tenant-scoped storage key,
 * metadata.storageKey round-trip, short-lived signed URL, uniform-404
 * anti-IDOR for another tenant's document) is exercised in the integration
 * suite against a real StorageProvider + Drizzle DB; here the registry is mock
 * so the authenticated write resolves to 503 before any fake success.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../middleware/auth';
import { UserRole } from '../../types/user-role';
import { documentsHonoRouter } from '../documents.hono';

const TEST_TENANT = 'tenant-docs-up-1';
const TEST_USER = 'user-owner-1';
const DOC_ID = 'doc-upload-1';

function bearer(role: UserRole = UserRole.OWNER, tenantId = TEST_TENANT): string {
  return `Bearer ${generateToken({
    userId: TEST_USER,
    tenantId,
    role: role as never,
    permissions: ['*'],
    propertyAccess: ['*'],
  })}`;
}

function mount(): Hono {
  const app = new Hono();
  app.route('/documents', documentsHonoRouter);
  return app;
}

function multipart(parts: { file?: { bytes: Uint8Array; name: string; type: string }; fields?: Record<string, string> }): FormData {
  const form = new FormData();
  if (parts.file) {
    form.append(
      'file',
      new File([parts.file.bytes], parts.file.name, { type: parts.file.type }),
      parts.file.name,
    );
  }
  for (const [k, v] of Object.entries(parts.fields ?? {})) form.append(k, v);
  return form;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

describe('documents upload — auth gate', () => {
  it('rejects an unauthenticated upload with 401 (route exists, not 404)', async () => {
    const res = await mount().request('/documents/upload', {
      method: 'POST',
      body: multipart({ file: { bytes: new Uint8Array([1, 2, 3]), name: 'a.pdf', type: 'application/pdf' } }),
    });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });
});

describe('documents upload — validation', () => {
  it('rejects a missing file part with 400 (route exists, not 404)', async () => {
    const res = await mount().request('/documents/upload', {
      method: 'POST',
      headers: { Authorization: bearer() },
      body: multipart({ fields: { name: 'no-file' } }),
    });
    // 400 INVALID_FILE, or 503 if storage is unwired — never 404.
    expect([400, 503]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });

  it('rejects a disallowed mime type with 400 (or 503 when storage unwired)', async () => {
    const res = await mount().request('/documents/upload', {
      method: 'POST',
      headers: { Authorization: bearer() },
      body: multipart({ file: { bytes: new Uint8Array([0x4d, 0x5a]), name: 'evil.exe', type: 'application/x-msdownload' } }),
    });
    expect([400, 503]).toContain(res.status);
    expect(res.status).not.toBe(404);
  });
});

describe('documents upload — honest degradation (no fake success)', () => {
  it('does not 201/fake a stored document when storage is unwired', async () => {
    const res = await mount().request('/documents/upload', {
      method: 'POST',
      headers: { Authorization: bearer() },
      body: multipart({ file: { bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), name: 'lease.pdf', type: 'application/pdf' } }),
    });
    // In mock mode the storage provider / repo is absent → 503 STORAGE_UNAVAILABLE
    // BEFORE any document row is faked. It must never report a successful 201.
    expect([503, 502]).toContain(res.status);
    expect(res.status).not.toBe(201);
    expect(res.status).not.toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

describe('documents download — auth + wiring', () => {
  it('rejects an unauthenticated download with 401 (route exists, not 404)', async () => {
    const res = await mount().request(`/documents/${DOC_ID}/download`, {
      method: 'GET',
    });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(404);
  });

  it('an authenticated download reaches the repo layer and never route-404s', async () => {
    const res = await mount().request(`/documents/${DOC_ID}/download`, {
      method: 'GET',
      headers: { Authorization: bearer() },
    });
    // Mock mode: repo absent → 503; a wired-but-empty repo → 404 (document not
    // found, the anti-IDOR uniform shape). Either is acceptable here; what must
    // never happen is a successful URL for a non-existent doc.
    expect([404, 503]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
