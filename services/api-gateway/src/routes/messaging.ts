/**
 * Messaging API routes - Hono with Zod validation
 * POST /conversations, GET /conversations,
 * GET /conversations/:id, GET /conversations/:id/messages
 * POST /conversations/:id/messages, PUT /conversations/:id/read
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/hono-auth';
import {
  idParamSchema,
  paginationQuerySchema,
  validationErrorHook,
} from './validators';
import { z } from 'zod';

const app = new Hono();

const createConversationSchema = z.object({
  participantIds: z.array(z.string()).min(1, 'At least one participant required'),
  subject: z.string().max(200).optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  initialMessage: z.string().max(5000).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(5000),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string().url(),
    name: z.string().optional(),
  })).optional(),
});

const listConversationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
  participantId: z.string().optional(),
});

const listMessagesQuerySchema = paginationQuerySchema.extend({
  before: z.string().optional(),
});

app.use('*', authMiddleware);

function errorResponse(
  c: { json: (body: unknown, status?: number) => Response },
  status: 404,
  code: string,
  message: string
) {
  return c.json({ success: false, error: { code, message } }, status);
}

// POST /messaging/conversations - Create conversation
app.post(
  '/conversations',
  zValidator('json', createConversationSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');

    const conversation = {
      id: `conv-${Date.now()}`,
      tenantId: auth.tenantId,
      participantIds: [auth.userId, ...body.participantIds],
      subject: body.subject,
      relatedEntityType: body.relatedEntityType,
      relatedEntityId: body.relatedEntityId,
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      createdAt: new Date().toISOString(),
    };

    return c.json({ success: true, data: conversation }, 201);
  }
);

// GET /messaging/conversations - List conversations
app.get('/conversations', zValidator('query', listConversationsQuerySchema), (c) => {
  const auth = c.get('auth');
  const { page, pageSize, unreadOnly } = c.req.valid('query');

  const conversations = [
    {
      id: 'conv-1',
      tenantId: auth.tenantId,
      subject: 'Unit A101 inquiry',
      lastMessageAt: new Date().toISOString(),
      unreadCount: 1,
    },
  ];

  let filtered = conversations.filter((conv) => conv.tenantId === auth.tenantId);
  if (unreadOnly) filtered = filtered.filter((conv) => conv.unreadCount > 0);

  const paginated = {
    data: filtered.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    },
  };

  return c.json({ success: true, ...paginated });
});

// GET /messaging/conversations/:id - Get conversation
app.get('/conversations/:id', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  const conversation = {
    id,
    tenantId: auth.tenantId,
    subject: 'Conversation details',
    participants: [],
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
  };

  return c.json({ success: true, data: conversation });
});

// GET /messaging/conversations/:id/messages - Get messages
app.get(
  '/conversations/:id/messages',
  zValidator('param', idParamSchema),
  zValidator('query', listMessagesQuerySchema),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const { page, pageSize } = c.req.valid('query');

    const messages = [
      {
        id: 'msg-1',
        conversationId: id,
        senderId: auth.userId,
        content: 'Hello, I have a question about the unit.',
        createdAt: new Date().toISOString(),
        read: true,
      },
    ];

    const paginated = {
      data: messages.slice((page - 1) * pageSize, page * pageSize),
      pagination: {
        page,
        pageSize,
        total: messages.length,
        totalPages: Math.ceil(messages.length / pageSize),
      },
    };

    return c.json({ success: true, ...paginated });
  }
);

// POST /messaging/conversations/:id/messages - Send message
app.post(
  '/conversations/:id/messages',
  zValidator('param', idParamSchema),
  zValidator('json', sendMessageSchema, validationErrorHook),
  (c) => {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const message = {
      id: `msg-${Date.now()}`,
      conversationId: id,
      senderId: auth.userId,
      content: body.content,
      attachments: body.attachments ?? [],
      createdAt: new Date().toISOString(),
      read: false,
    };

    return c.json({ success: true, data: message }, 201);
  }
);

// PUT /messaging/conversations/:id/read - Mark as read
app.put('/conversations/:id/read', zValidator('param', idParamSchema), (c) => {
  const auth = c.get('auth');
  const { id } = c.req.valid('param');

  return c.json({
    success: true,
    data: {
      id,
      read: true,
      readAt: new Date().toISOString(),
    },
  });
});

export const messagingRouter = app;
