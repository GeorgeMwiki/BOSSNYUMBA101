// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union widens
//   across multiple c.json branches.

/**
 * /api/v1/owner/messaging/{broadcasts,campaigns,templates} — owner-portal
 * Communications page skeletons.
 *
 * Wave-2 commit 0ee27a0 converted three communications pages to
 * `MissingBackendNotice` components with these endpoints:
 *
 *   GET /api/v1/owner/messaging/broadcasts  (CommunicationsBroadcastsPage)
 *   GET /api/v1/owner/messaging/campaigns   (CommunicationsCampaignsPage)
 *   GET /api/v1/owner/messaging/templates   (CommunicationsTemplatesPage)
 *
 * The owner-portal already has working `/owner/messaging/conversations*`
 * endpoints (resident <-> manager DMs). The three new surfaces
 * (broadcasts, campaigns, templates) target a *different* domain — bulk
 * outbound communication — that doesn't have a backing service yet.
 *
 * Each handler returns an empty list + `X-Backend-Status: degraded`.
 * Mounted at `/owner` in index.ts so paths line up with the FE.
 *
 * TODO(api-gateway, COMMS-001): wire bulk-comms domain.
 *   Concrete next-step:
 *     1. Add migrations: `comms_broadcasts`, `comms_campaigns`,
 *        `comms_templates` (all tenantId-scoped, with status enum +
 *        scheduled-at + audit fields).
 *     2. Add `CommunicationsService` in @bossnyumba/domain-services
 *        with `listBroadcasts/listCampaigns/listTemplates(tenantId)`.
 *     3. Replace the degraded payloads with real queries.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/hono-auth';
import { requireRole } from '../../middleware/authorization';
import { UserRole } from '../../types/user-role';
import { buildDegradedList, markDegraded } from './degraded-shape';

const BROADCASTS_NEXT_STEP =
  'create comms_broadcasts table + CommunicationsService.listBroadcasts(tenantId) and replace this skeleton';
const CAMPAIGNS_NEXT_STEP =
  'create comms_campaigns table + CommunicationsService.listCampaigns(tenantId) and replace this skeleton';
const TEMPLATES_NEXT_STEP =
  'create comms_templates table + CommunicationsService.listTemplates(tenantId) and replace this skeleton';

const app = new Hono();
app.use('*', authMiddleware);
app.use(
  '*',
  requireRole(
    UserRole.OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  ),
);

app.get('/broadcasts', (c) => {
  const auth = c.get('auth');
  markDegraded(c);
  return c.json(buildDegradedList(auth.tenantId, BROADCASTS_NEXT_STEP));
});

app.get('/campaigns', (c) => {
  const auth = c.get('auth');
  markDegraded(c);
  return c.json(buildDegradedList(auth.tenantId, CAMPAIGNS_NEXT_STEP));
});

app.get('/templates', (c) => {
  const auth = c.get('auth');
  markDegraded(c);
  return c.json(buildDegradedList(auth.tenantId, TEMPLATES_NEXT_STEP));
});

export const ownerMessagingRouter = app;
