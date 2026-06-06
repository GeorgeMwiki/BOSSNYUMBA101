/**
 * Cases evidence-attachment route tests.
 *
 * Cover the end-to-end durable-evidence surface added to the cases
 * router:
 *   - POST /cases/:id/evidence  — multipart upload → storage → insert
 *   - GET  /cases/:id/evidence  — tenant-scoped list
 *
 * The router is exercised without a live Postgres by pre-injecting a stub
 * `db.execute` (pattern-matching the serialized SQL, same technique as
 * cases-router.test.ts) and a stub `documentStorage.provider` on the
 * `services` context bag. Tenant scoping is asserted by feeding the stub
 * a case that is NOT owned by the caller and expecting a 404.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { casesRouter } from '../routes/cases.hono';
import { getJwtSecret } from '../config/jwt';

interface StorageCall {
  readonly key: string;
  readonly contentType: string;
  readonly bytes: number;
}

interface DbStubOptions {
  /** When false, the case-ownership lookup returns zero rows (→ 404). */
  readonly caseOwnedByTenant?: boolean;
}

function flattenSql(query: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    if (typeof node === 'object') {
      const n = node as Record<string, unknown>;
      if ('value' in n) walk(n.value);
      if ('queryChunks' in n) walk(n.queryChunks);
    }
  };
  walk((query as { queryChunks?: unknown[] }).queryChunks ?? []);
  return out.join(' ').toLowerCase();
}

function makeDbStub(opts: DbStubOptions = {}) {
  const owned = opts.caseOwnedByTenant ?? true;
  const calls: string[] = [];
  const evidenceRow = {
    id: 'ev-1',
    tenant_id: 'tn_case_test',
    case_id: 'case-abc',
    uploaded_by: 'usr_case_test',
    file_name: 'leak.jpg',
    file_url: 'https://storage.example.com/cases/case-abc/evidence/ev-1-leak.jpg',
    mime_type: 'image/jpeg',
    file_size_bytes: 1234,
    description: 'kitchen leak',
    exhibit_label: null,
    sealed: false,
    created_at: '2026-06-06T00:00:00Z',
  };

  const db = {
    execute: async (query: unknown) => {
      const raw = flattenSql(query);

      // Case-ownership probe: `SELECT id FROM cases WHERE id = ... AND tenant_id = ...`
      if (raw.includes('select id from cases')) {
        calls.push('case-owner');
        return (owned ? [{ id: 'case-abc' }] : []) as unknown;
      }
      if (raw.includes('insert into evidence_attachments')) {
        calls.push('insert-evidence');
        return [evidenceRow] as unknown;
      }
      if (raw.includes('select * from evidence_attachments')) {
        calls.push('list-evidence');
        return [evidenceRow] as unknown;
      }
      if (raw.includes('update cases')) {
        calls.push('photos-cache');
        return [] as unknown;
      }
      calls.push('other');
      return [] as unknown;
    },
  };

  return { db, calls };
}

function makeStorageStub() {
  const uploads: StorageCall[] = [];
  const provider = {
    upload: async (input: {
      key: string;
      content: Buffer;
      contentType: string;
    }) => {
      uploads.push({
        key: input.key,
        contentType: input.contentType,
        bytes: input.content.byteLength,
      });
      return { key: input.key, url: `https://storage.example.com/${input.key}` };
    },
  };
  return { provider, uploads };
}

function mintJwt(): string {
  return jwt.sign(
    {
      userId: 'usr_case_test',
      tenantId: 'tn_case_test',
      role: 'TENANT_ADMIN',
      permissions: ['*'],
      propertyAccess: ['*'],
    },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '2h' },
  );
}

interface BuildOptions extends DbStubOptions {
  readonly withStorage?: boolean;
}

function buildApp(opts: BuildOptions = {}) {
  const app = new Hono();
  const { db, calls } = makeDbStub(opts);
  const storage = makeStorageStub();
  app.use('*', async (c, next) => {
    c.set('db', db as unknown as never);
    if (opts.withStorage ?? true) {
      c.set(
        'services',
        { documentStorage: { provider: storage.provider } } as unknown as never,
      );
    }
    await next();
  });
  app.route('/cases', casesRouter);
  return { app, calls, uploads: storage.uploads };
}

function evidenceForm(): FormData {
  const form = new FormData();
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
  form.append('file', blob, 'leak.jpg');
  form.append('metadata', JSON.stringify({ caption: 'kitchen leak' }));
  return form;
}

describe('cases evidence router', () => {
  it('POST /cases/:id/evidence stores the blob and inserts the row', async () => {
    const { app, calls, uploads } = buildApp();
    const res = await app.request('/cases/case-abc/evidence', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt()}` },
      body: evidenceForm(),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      success: boolean;
      data: { id: string; fileUrl: string; caption: string; mimeType: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('ev-1');
    expect(body.data.mimeType).toBe('image/jpeg');
    expect(body.data.caption).toBe('kitchen leak');
    // The blob was streamed to storage before the row was inserted.
    expect(uploads.length).toBe(1);
    expect(uploads[0].contentType).toBe('image/jpeg');
    expect(uploads[0].bytes).toBe(4);
    expect(calls).toContain('case-owner');
    expect(calls).toContain('insert-evidence');
    // Image is mirrored into the cases.photos display cache.
    expect(calls).toContain('photos-cache');
  });

  it('POST /cases/:id/evidence is tenant-scoped — 404 when the case is not the caller\'s', async () => {
    const { app, uploads } = buildApp({ caseOwnedByTenant: false });
    const res = await app.request('/cases/case-other/evidence', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt()}` },
      body: evidenceForm(),
    });
    expect(res.status).toBe(404);
    // No blob is stored when ownership fails.
    expect(uploads.length).toBe(0);
  });

  it('POST /cases/:id/evidence rejects a disallowed mime type (400)', async () => {
    const { app, uploads } = buildApp();
    const form = new FormData();
    const blob = new Blob(['#!/bin/sh\n'], { type: 'application/x-sh' });
    form.append('file', blob, 'evil.sh');
    const res = await app.request('/cases/case-abc/evidence', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt()}` },
      body: form,
    });
    expect(res.status).toBe(400);
    expect(uploads.length).toBe(0);
  });

  it('POST /cases/:id/evidence requires a file field (400)', async () => {
    const { app } = buildApp();
    const form = new FormData();
    form.append('metadata', JSON.stringify({ caption: 'no file' }));
    const res = await app.request('/cases/case-abc/evidence', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt()}` },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it('POST /cases/:id/evidence returns 503 when storage is not configured', async () => {
    const { app } = buildApp({ withStorage: false });
    const res = await app.request('/cases/case-abc/evidence', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mintJwt()}` },
      body: evidenceForm(),
    });
    expect(res.status).toBe(503);
  });

  it('GET /cases/:id/evidence lists the tenant-scoped attachments', async () => {
    const { app, calls } = buildApp();
    const res = await app.request('/cases/case-abc/evidence', {
      headers: { Authorization: `Bearer ${mintJwt()}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{ id: string; fileName: string }>;
    };
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].fileName).toBe('leak.jpg');
    expect(calls).toContain('case-owner');
    expect(calls).toContain('list-evidence');
  });

  it('GET /cases/:id/evidence is tenant-scoped — 404 for a non-owned case', async () => {
    const { app } = buildApp({ caseOwnedByTenant: false });
    const res = await app.request('/cases/case-other/evidence', {
      headers: { Authorization: `Bearer ${mintJwt()}` },
    });
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated evidence requests (401)', async () => {
    const { app } = buildApp();
    const res = await app.request('/cases/case-abc/evidence');
    expect(res.status).toBe(401);
  });
});
