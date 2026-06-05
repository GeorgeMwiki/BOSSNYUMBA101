/**
 * Cooperatives sub-router — mounts at /api/v1/cooperatives.
 *
 * Currently composes the housing-cooperative settlement-period surface
 * (migration 0304). Future cooperative-domain endpoints (member-household
 * registry, levies/charge config, contested-period dispute) hang off this
 * same router.
 */

import { Hono } from 'hono';
import { cooperativeSettlementsRouter } from './cooperatives.hono';

const app = new Hono();
app.route('/', cooperativeSettlementsRouter);

export const cooperativesRouter = app;
