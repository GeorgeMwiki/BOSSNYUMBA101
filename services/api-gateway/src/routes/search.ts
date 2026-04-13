/**
 * Search API routes - stub endpoint for owner search screen
 * Returns empty results so the mobile app does not crash on 404s.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';

const app = new Hono();
app.use('*', authMiddleware);

// TODO: wire to real data source (full-text search across properties, units, customers, etc.)
app.get('/', (c) => {
  const query = c.req.query('q') || c.req.query('query') || '';
  const type = c.req.query('type'); // properties, units, customers, leases, etc.

  return c.json({
    success: true,
    data: {
      query,
      type: type || 'all',
      results: [],
      totalResults: 0,
    },
  });
});

export const searchRouter = app;
