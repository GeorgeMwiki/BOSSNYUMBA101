/**
 * Notifications API routes - Hono gateway
 *
 * Forwards requests to the upstream notifications service (services/notifications)
 * over HTTP. Provides graceful 503 fallback when the service is unreachable.
 *
 * Upstream base URL:  NOTIFICATIONS_SERVICE_URL  (default: http://notifications:4100)
 * Internal auth:       INTERNAL_API_KEY          (signs X-Internal-Token header)
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/hono-auth';
import { validationErrorHook } from './validators';

const app = new Hono();

app.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// Config & helpers
// ---------------------------------------------------------------------------

const NOTIFICATIONS_SERVICE_URL =
  process.env.NOTIFICATIONS_SERVICE_URL || 'http://notifications:4100';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

const UPSTREAM_TIMEOUT_MS = 5_000;

/** Build the upstream URL, safely joining base and path. */
function upstreamUrl(path: string, query?: Record<string, string | undefined>): string {
  const base = NOTIFICATIONS_SERVICE_URL.replace(/\/+$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(base + clean);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

/** Build headers for the upstream request. */
function upstreamHeaders(c: Context): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const auth = c.get('auth');
  if (auth?.tenantId) headers['X-Tenant-Id'] = String(auth.tenantId);
  if (auth?.userId) headers['X-User-Id'] = String(auth.userId);
  if (auth?.role) headers['X-User-Role'] = String(auth.role);

  const incomingAuth = c.req.header('Authorization');
  if (INTERNAL_API_KEY) {
    // Sign the internal token with the configured API key so the upstream
    // can distinguish gateway-forwarded calls. Pass the JWT too for audit.
    headers['X-Internal-Token'] = INTERNAL_API_KEY;
    if (incomingAuth) headers['X-Forwarded-Authorization'] = incomingAuth;
  } else if (incomingAuth) {
    // No shared secret configured - forward the caller's JWT directly.
    headers['Authorization'] = incomingAuth;
  }

  const reqId = c.req.header('X-Request-Id');
  if (reqId) headers['X-Request-Id'] = reqId;

  return headers;
}

/** Shape of the JSON we return when the upstream can't be reached. */
function unavailableResponse(c: Context) {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOTIFICATIONS_UNAVAILABLE',
        message: 'Notifications service is not reachable',
      },
    },
    503
  );
}

/** Call the upstream service with a 5s abort timeout. */
async function callUpstream(
  c: Context,
  method: string,
  path: string,
  opts: { query?: Record<string, string | undefined>; body?: unknown } = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const init: RequestInit = {
      method,
      headers: upstreamHeaders(c),
      signal: controller.signal,
    };
    if (opts.body !== undefined) {
      init.body = JSON.stringify(opts.body);
    }
    return await fetch(upstreamUrl(path, opts.query), init);
  } finally {
    clearTimeout(timer);
  }
}

/** Forward an upstream Response back to the caller. */
async function forward(c: Context, res: Response) {
  const contentType = res.headers.get('content-type') || '';
  // Hono's c.json/c.text expect a narrow StatusCode union; upstream may
  // surface any HTTP number, so cast explicitly to the Hono StatusCode.
  const status = res.status as import('hono/utils/http-status').StatusCode;
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => null);
    return c.json(data ?? { success: res.ok }, status);
  }
  const text = await res.text().catch(() => '');
  return c.text(text, status);
}

/** Decide whether an error from `fetch` is a network-level failure. */
function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: string; cause?: { code?: string } };
  if (e.name === 'AbortError') return true;
  const code = e.code || e.cause?.code;
  if (!code) {
    // Undici throws TypeError('fetch failed') for connection refused.
    return e.name === 'TypeError' || e.name === 'FetchError';
  }
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ETIMEDOUT',
    'UND_ERR_SOCKET',
    'UND_ERR_CONNECT_TIMEOUT',
  ].includes(code);
}

/** Wrap an upstream call so network failures render as 503 NOTIFICATIONS_UNAVAILABLE. */
async function proxy(
  c: Context,
  fn: () => Promise<Response>
): Promise<Response> {
  try {
    const res = await fn();
    return forward(c, res);
  } catch (err) {
    if (isNetworkError(err)) return unavailableResponse(c);
    // Unexpected error - surface as 502 rather than generic 500 for clarity.
    return c.json(
      {
        success: false,
        error: {
          code: 'NOTIFICATIONS_UPSTREAM_ERROR',
          message: 'Unexpected error contacting notifications service',
        },
      },
      502
    );
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['unread', 'read', 'all']).optional(),
  category: z.string().optional(),
});

const sendBodySchema = z.object({
  userId: z.string().min(1).optional(),
  userIds: z.array(z.string().min(1)).optional(),
  channel: z
    .enum(['email', 'sms', 'whatsapp', 'push', 'in_app'])
    .optional(),
  channels: z
    .array(z.enum(['email', 'sms', 'whatsapp', 'push', 'in_app']))
    .optional(),
  templateId: z.string().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
  data: z.record(z.unknown()).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  scheduledAt: z.string().datetime().optional(),
}).refine(
  (v) => v.userId || (v.userIds && v.userIds.length > 0),
  { message: 'userId or userIds is required' }
).refine(
  (v) => v.templateId || v.body,
  { message: 'templateId or body is required' }
);

const channelPrefsSchema = z.object({
  enabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
}).passthrough();

const preferencesBodySchema = z.object({
  email: channelPrefsSchema.optional(),
  sms: channelPrefsSchema.optional(),
  whatsapp: channelPrefsSchema.optional(),
  push: channelPrefsSchema.optional(),
  inApp: channelPrefsSchema.optional(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().optional(),
  templates: z.record(z.unknown()).optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /preferences  - must be defined BEFORE '/:id' to avoid route collision.
app.get('/preferences', (c) =>
  proxy(c, () =>
    callUpstream(c, 'GET', '/preferences', {
      query: { userId: c.get('auth').userId, tenantId: c.get('auth').tenantId },
    })
  )
);

// PATCH /preferences
app.patch(
  '/preferences',
  zValidator('json', preferencesBodySchema, validationErrorHook),
  (c) => {
    const body = c.req.valid('json');
    const auth = c.get('auth');
    return proxy(c, () =>
      callUpstream(c, 'PATCH', '/preferences', {
        query: { userId: auth.userId, tenantId: auth.tenantId },
        body,
      })
    );
  }
);

// POST /send - admin/service trigger
app.post(
  '/send',
  zValidator('json', sendBodySchema, validationErrorHook),
  (c) => {
    const body = c.req.valid('json');
    const auth = c.get('auth');
    return proxy(c, () =>
      callUpstream(c, 'POST', '/notifications/send', {
        body: {
          ...body,
          tenantId: auth.tenantId,
          requestedBy: auth.userId,
        },
      })
    );
  }
);

// GET / - list for current user
app.get(
  '/',
  zValidator('query', listQuerySchema, validationErrorHook),
  (c) => {
    const q = c.req.valid('query');
    const auth = c.get('auth');
    return proxy(c, () =>
      callUpstream(c, 'GET', '/notifications', {
        query: {
          userId: auth.userId,
          tenantId: auth.tenantId,
          page: q.page !== undefined ? String(q.page) : undefined,
          pageSize: q.pageSize !== undefined ? String(q.pageSize) : undefined,
          status: q.status,
          category: q.category,
        },
      })
    );
  }
);

// POST /:id/read - mark as read
app.post('/:id/read', (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  return proxy(c, () =>
    callUpstream(c, 'POST', `/notifications/${encodeURIComponent(id)}/read`, {
      body: { userId: auth.userId, tenantId: auth.tenantId },
    })
  );
});

// GET /:id - fetch one (keep last so it doesn't shadow other routes)
app.get('/:id', (c) => {
  const id = c.req.param('id');
  const auth = c.get('auth');
  return proxy(c, () =>
    callUpstream(c, 'GET', `/notifications/${encodeURIComponent(id)}`, {
      query: { userId: auth.userId, tenantId: auth.tenantId },
    })
  );
});

export const notificationsRouter = app;
export default app;
