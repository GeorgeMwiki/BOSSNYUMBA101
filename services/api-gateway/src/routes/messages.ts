// @ts-nocheck
/**
 * Messages API routes
 *
 * Thin facade over the messaging domain service. If the messaging
 * domain-service cannot be loaded (the package is missing or the repository
 * is not wired in this environment), the endpoints return
 * 501 Not Implemented with `{ error: 'messaging-not-configured' }` so
 * that clients can gracefully degrade rather than treat stubbed fake
 * success responses as real data.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

interface MessagingHandle {
  available: boolean;
  service?: any;
  reason?: string;
}

let handlePromise: Promise<MessagingHandle> | null = null;

async function loadMessaging(): Promise<MessagingHandle> {
  try {
    const mod: any = await import('@bossnyumba/domain-services');
    if (!mod?.MessagingService || !mod?.MemoryMessagingRepository) {
      return {
        available: false,
        reason: 'MessagingService export not found in @bossnyumba/domain-services',
      };
    }
    const repo = new mod.MemoryMessagingRepository();
    const eventBus = { async publish() {} };
    const service = new mod.MessagingService(repo, eventBus);
    return { available: true, service };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function getHandle(): Promise<MessagingHandle> {
  if (!handlePromise) handlePromise = loadMessaging();
  return handlePromise;
}

function notImplemented(c: any, reason?: string) {
  return c.json(
    {
      success: false,
      error: 'messaging-not-configured',
      message: 'Messaging service is not wired in this environment.',
      detail: reason,
    },
    501
  );
}

const app = new Hono();
app.use('*', authMiddleware);

// GET /conversations - list for current user
app.get('/conversations', async (c) => {
  const handle = await getHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const activeOrgId = c.get('activeOrgId') || auth.tenantId;
  const result = await handle.service.getConversations(activeOrgId, auth.userId);
  return c.json({ success: true, data: result.items, pagination: { total: result.total, limit: result.limit, offset: result.offset } });
});

// POST /conversations - create
app.post('/conversations', async (c) => {
  const handle = await getHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const activeOrgId = c.get('activeOrgId') || auth.tenantId;
  const body = await c.req.json().catch(() => ({}));

  if (!body.type || !body.subject) {
    return c.json(
      { success: false, error: 'validation-failed', message: 'type and subject are required' },
      400
    );
  }

  const participants = Array.isArray(body.participantIds)
    ? body.participantIds.map((uid: string) => ({ userId: uid, role: 'member' }))
    : [];

  const result = await handle.service.createConversation(
    activeOrgId,
    body.type,
    participants,
    body.subject,
    auth.userId,
    body.metadata
  );

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 400);
  }
  return c.json({ success: true, data: result.data }, 201);
});

// GET /conversations/:id
app.get('/conversations/:id', async (c) => {
  const handle = await getHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const activeOrgId = c.get('activeOrgId') || auth.tenantId;
  const id = c.req.param('id');

  const result = await handle.service.getConversation(id, activeOrgId);
  if (!result.success) {
    return c.json({ success: false, error: result.error }, 404);
  }
  return c.json({ success: true, data: result.data });
});

// GET /conversations/:id/messages
app.get('/conversations/:id/messages', async (c) => {
  const handle = await getHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const activeOrgId = c.get('activeOrgId') || auth.tenantId;
  const id = c.req.param('id');
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);

  const result = await handle.service.getMessages(id, activeOrgId, { limit, offset });
  if (!result.success) {
    return c.json({ success: false, error: result.error }, 404);
  }
  return c.json({
    success: true,
    data: result.data.items,
    pagination: { total: result.data.total, limit: result.data.limit, offset: result.data.offset },
  });
});

// POST /conversations/:id/messages
app.post('/conversations/:id/messages', async (c) => {
  const handle = await getHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const activeOrgId = c.get('activeOrgId') || auth.tenantId;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  if (!body.content || typeof body.content !== 'string') {
    return c.json(
      { success: false, error: 'validation-failed', message: 'content is required' },
      400
    );
  }

  const result = await handle.service.sendMessage(
    id,
    activeOrgId,
    auth.userId,
    body.content,
    Array.isArray(body.attachments) ? body.attachments : undefined
  );

  if (!result.success) {
    const status = result.error.code === 'CONVERSATION_NOT_FOUND' ? 404 : 400;
    return c.json({ success: false, error: result.error }, status);
  }
  return c.json({ success: true, data: result.data }, 201);
});

// PUT /conversations/:id/read
app.put('/conversations/:id/read', async (c) => {
  const handle = await getHandle();
  if (!handle.available) return notImplemented(c, handle.reason);

  const auth = c.get('auth');
  const activeOrgId = c.get('activeOrgId') || auth.tenantId;
  const id = c.req.param('id');

  const result = await handle.service.markAsRead(id, activeOrgId, auth.userId);
  if (!result.success) {
    const status = result.error.code === 'CONVERSATION_NOT_FOUND' ? 404 : 400;
    return c.json({ success: false, error: result.error }, status);
  }
  return c.json({ success: true, data: { id, readAt: new Date().toISOString() } });
});

export const messagesRouter = app;
