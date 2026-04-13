/**
 * AI API routes - stub endpoints for copilot chat and morning briefing
 * Returns placeholder responses so the mobile app does not crash on 404s.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real AI/LLM service
app.post('/copilot/chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const message = body.message || body.prompt || '';

  return c.json({
    success: true,
    data: {
      id: `ai-${Date.now()}`,
      message,
      response: 'AI copilot is not yet connected. This is a placeholder response.',
      model: 'stub',
      createdAt: new Date().toISOString(),
    },
  });
});

// TODO: wire to real AI/LLM service
app.get('/copilot/history', (c) => {
  return c.json({
    success: true,
    data: [],
  });
});

// TODO: wire to real AI/LLM briefing generator
app.get('/briefing', (c) => {
  const now = new Date();
  return c.json({
    success: true,
    data: {
      date: now.toISOString().split('T')[0],
      generatedAt: now.toISOString(),
      summary: 'Morning briefing is not yet available. This is a placeholder.',
      sections: [],
      actionItems: [],
    },
  });
});

export const aiRouter = app;
