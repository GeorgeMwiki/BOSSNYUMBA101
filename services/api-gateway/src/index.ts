/**
 * @bossnyumba/api-gateway
 *
 * API Gateway / Backend-for-Frontend for the BOSSNYUMBA platform.
 * Handles authentication, authorization, request routing, and aggregation.
 */

// Auto-load .env FIRST — before any module reads process.env. Look at
// repo root (cwd/../../.env from services/api-gateway) and the service
// folder. Tests + prod skip via BOSSNYUMBA_SKIP_DOTENV=true.
import { config as loadDotenv } from 'dotenv';
import { resolve as resolvePath } from 'node:path';
if (!process.env.BOSSNYUMBA_SKIP_DOTENV) {
  // cwd when started via `pnpm dev` is services/api-gateway. Repo root is 2 up.
  // override=true ensures stale shell exports (e.g. empty ANTHROPIC_API_KEY
  // left in a previous terminal) don't beat the canonical .env values.
  loadDotenv({ path: resolvePath(process.cwd(), '../../.env'), override: true });
  loadDotenv({ path: resolvePath(process.cwd(), '.env'), override: true });
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { handle } from '@hono/node-server/vercel';
import { Hono } from 'hono';
import { authRouter } from './routes/auth';
import { authMfaRouter } from './routes/auth-mfa';
import { tenantsRouter } from './routes/tenants.hono';
import { usersRouter } from './routes/users.hono';
import { propertiesRouter } from './routes/properties';
import { unitsRouter } from './routes/units';
import { customersRouter } from './routes/customers';
import { leasesRouter } from './routes/leases';
import { invoicesApp } from './routes/invoices';
import { paymentsApp } from './routes/payments';
import { workOrdersRouter } from './routes/work-orders.hono';
import { vendorsRouter } from './routes/vendors.hono';
import { notificationsRouter } from './routes/notifications';
import { reportsHonoRouter } from './routes/reports.hono';
import { dashboardRouter } from './routes/dashboard.hono';
import { onboardingRouter } from './routes/onboarding';
import { feedbackRouter } from './routes/feedback';
import { complaintsRouter } from './routes/complaints';
import { inspectionsRouter } from './routes/inspections';
import { documentsHonoRouter } from './routes/documents.hono';
import { schedulingRouter } from './routes/scheduling';
import { messagingRouter } from './routes/messaging';
import { casesRouter } from './routes/cases.hono';
import { brainRouter } from './routes/brain.hono';
import { maintenanceRouter } from './routes/maintenance.hono';
import { hrRouter } from './routes/hr.hono';
// Wave 1-2 routers (new domain features)
import applicationsRouter from './routes/applications.router';
import arrearsRouter from './routes/arrears.router';
import complianceRouter from './routes/compliance.router';
import compliancePluginsRouter from './routes/compliance-plugins.router';
import docChatRouter from './routes/doc-chat.router';
import documentRenderRouter from './routes/document-render.router';
import financialProfileRouter from './routes/financial-profile.router';
import gamificationRouter from './routes/gamification.router';
import gepgRouter from './routes/gepg.router';
import interactiveReportsRouter from './routes/interactive-reports.router';
import lettersRouter from './routes/letters.router';
import { marketplaceRouter } from './routes/marketplace.router';
import { createMigrationRouter } from './routes/migration.router';
import { negotiationsRouter } from './routes/negotiations.router';
import { createNotificationPreferencesRouter } from './routes/notification-preferences.router';
import { createNotificationWebhookRouter } from './routes/notification-webhooks.router';
import occupancyTimelineRouter from './routes/occupancy-timeline.router';
import renewalsRouter from './routes/renewals.router';
import riskReportsRouter from './routes/risk-reports.router';
import scansRouter from './routes/scans.router';
import stationMasterCoverageRouter from './routes/station-master-coverage.router';
import { tendersRouter } from './routes/tenders.router';
import { waitlistRouter } from './routes/waitlist.router';
// Wave 8 gap-closure routers
import warehouseRouter from './routes/warehouse.router';
import maintenanceTaxonomyRouter from './routes/maintenance-taxonomy.router';
import iotRouter from './routes/iot.router';
import lpmsRouter from './routes/lpms.router';
// Wave 9 enterprise polish routers
import featureFlagsRouter from './routes/feature-flags.router';
import gdprRouter from './routes/gdpr.router';
import aiCostsRouter from './routes/ai-costs.router';
// Wave 12 — metrics / observability snapshot
import { metricsRouter } from './routes/metrics.router';
import { createMetricsMiddleware } from './observability/metrics-middleware';
// Wave 12 — MCP server + agent platform
import mcpRouter, { agentCardRouter } from './routes/mcp.router';
// Wave 11 — public marketing (Mr. Mwikila), workflows
import publicMarketingRouter from './routes/public-marketing.router';
import publicSandboxRouter from './routes/public-sandbox.router';
import publicLeadsRouter from './routes/public-leads.router';
// Wave 12 — streaming AI chat (SSE) for all 4 chat surfaces
import aiChatRouter from './routes/ai-chat.router';
import workflowsRouter from './routes/workflows.router';
import agentCertificationsRouter from './routes/agent-certifications.router';
import classroomRouter from './routes/classroom.router';
import trainingRouter from './routes/training.router';
import voiceRouter from './routes/voice.router';
// Wave 13 — Autonomous Department Mode routers
import exceptionsRouter from './routes/exceptions.router';
import autonomousActionsAuditRouter from './routes/autonomous-actions-audit.router';
import autonomyRouter from './routes/autonomy.router';
// Wave 28 Phase A Agent PhA2 — monthly-close orchestrator.
import monthlyCloseRouter from './routes/monthly-close.router';
// Organizational Awareness — "talk to your organization" endpoints
import orgAwarenessRouter from './routes/org-awareness.router';
// Tenant Credit Rating — FICO-scale credit + portable certificate
import creditRatingRouter from './routes/credit-rating.router';
// Property Grading — Mr. Mwikila's A–F report card system (migration 0088)
import propertyGradingRouter from './routes/property-grading.router';
// AI-Native suite — Agent PhG: 8 capabilities that leverage LLMs at scale.
import aiNativeRouter from './routes/ai-native.router';
// Wave 26 — Agent Z2: expose four repos that had tests but no HTTP surface.
import subleaseRouter from './routes/sublease.router';
import damageDeductionsRouter from './routes/damage-deductions.router';
import conditionalSurveysRouter from './routes/conditional-surveys.router';
import farRouter from './routes/far.router';
// Wave 26 Z3 — Move-out checklist + Approval workflow (migration 0097)
import moveOutRouter from './routes/move-out.router';
import approvalsRouter from './routes/approvals.router';
// Wave 27 PhA1 — Vacancy-to-Lease orchestrator (migration 0098)
import vacancyPipelineRouter from './routes/vacancy-pipeline.router';
// Phase B Wave 30 — Task-Agents registry + executor (narrow-scope agents)
import taskAgentsRouter from './routes/task-agents.router';
// Wave 27 Agent E — Tenant Branding (per-tenant AI persona identity overrides)
import tenantBrandingRouter from './routes/tenant-branding.router';
// Wave 27 Agent C — Audit Trail v2 (cryptographically-verifiable append-only log)
import auditTrailRouter from './routes/audit-trail.router';
// Wave 27 Agent F — Risk-recompute dispatcher manual-trigger surface.
import { createRiskRecomputeRouter } from './routes/risk-recompute.router';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
import { createRateLimitMiddleware } from './middleware/rate-limit-redis.middleware';
import {
  startOutboxWorker,
  stopOutboxWorker,
  type OutboxRunnerLike,
} from './workers/outbox-worker';
import { createCaseSLASupervisor } from './workers/cases-sla-supervisor';
import {
  registerDomainEventSubscribers,
  type SubscribableBus,
  type NotificationDispatcher,
} from './workers/event-subscribers';
import { ensureTenantIsolation } from './middleware/tenant-context.middleware';
import { assertApiKeyConfig } from './middleware/api-key-registry';
import { customerAppRouter } from './routes/bff/customer-app';
import { ownerPortalRouter } from './routes/bff/owner-portal';
import { estateManagerAppRouter } from './routes/bff/estate-manager-app';
import { adminPortalRouter } from './routes/bff/admin-portal';
import { buildServices, type ServiceRegistry } from './composition/service-registry';
import { getDb } from './composition/db-client';
import { createServiceContextMiddleware } from './composition/service-context.middleware';
import {
  createHeartbeatSupervisor,
  createBackgroundSupervisor,
  createPostgresWebhookDeliveryRepository,
  createAmbientBehaviorObserver,
  createIntelligenceHistorySupervisor,
} from './composition/background-wiring';
import { setBrainExtraSkills } from './composition/brain-extensions';
import { buildQueryOrganizationTool } from '@bossnyumba/ai-copilot';
import { createAmbientBrainMiddleware } from './middleware/ambient-brain.middleware';
import { createWebhookDlqRouter } from './routes/webhook-dlq.router';
import { createOpenApiRouter } from './openapi';
import {
  createDeepHealthHandler,
  postgresProbe,
  redisProbe,
  anthropicProbe,
  openaiProbe,
  elevenLabsProbe,
  gepgProbe,
} from './health/deep-health';
import { validateEnv } from './config/validate-env';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

// Fail-fast env validation — throws with a precise error message if required
// vars (DATABASE_URL, JWT_SECRET) are missing or malformed. Warnings are
// logged but do not block boot. Skipped in test environments where vitest
// provides its own fixtures.
if (process.env.NODE_ENV !== 'test') {
  try {
    const { warnings } = validateEnv(process.env);
    for (const w of warnings) logger.warn({ env: true }, w);
  } catch (err) {
    logger.fatal(
      { err: err instanceof Error ? err.message : String(err) },
      'Environment validation failed — aborting boot'
    );
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
}

const app = express();
const port = process.env.PORT || 4000;

// Hoisted flag — flipped by gracefulShutdown so /health + /healthz start
// returning 503 the moment a SIGTERM lands. Load balancers see the
// unhealthy status and drain traffic before in-flight requests finish.
let isShuttingDown = false;

// Middleware
app.use(helmet());

// CORS — restrict to allowed origins. Wildcard CORS combined with cookie
// auth would enable CSRF; header-based auth alone is defensible, but we
// whitelist anyway so the attack surface is minimal. Origins come from the
// env var; absence is fatal in production.
const allowedOrigins = (() => {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (raw) return raw.split(',').map((o) => o.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'api-gateway: ALLOWED_ORIGINS env var is required in production ' +
        '(comma-separated list of https://... origins).'
    );
  }
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
  ];
})();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server calls (no Origin) and explicitly whitelisted
      // browser origins. Deny everything else.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-ID',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
    maxAge: 86_400,
  })
);
// Skip express.json() for /api/v1 paths — those are handled by the
// Hono sub-app which consumes the raw request body itself. Running
// express.json() first would drain the body stream and Hono would
// see an empty request. No Express handler outside /api/v1 reads
// req.body today, but we keep the parser for potential future use.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1')) return next();
  return express.json({ limit: '2mb' })(req, res, next);
});
app.use(pinoHttp({ logger }));
// Rate limit — when REDIS_URL is set we use the Redis-backed limiter so
// the cap is enforced cluster-wide (HPA scales the gateway 3-20 replicas;
// the in-memory limiter would otherwise allow `max * replicas` requests).
// If REDIS_URL is unset (local dev / tests) we fall back to the original
// in-memory middleware so those paths continue to work. The Redis-backed
// middleware also degrades to in-memory on its own if the pipeline throws,
// so a Redis outage never hard-fails a request.
app.use(
  (() => {
    if (!process.env.REDIS_URL) {
      logger.info('rate-limit: REDIS_URL unset — using in-memory limiter (dev mode)');
      return rateLimitMiddleware();
    }
    try {
      // Lazy-require ioredis — the ESM / CJS export shape varies across
      // bundlers; mirror the pattern already used by the deep-health probe
      // so both code paths pick up the same constructor.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ioredisMod = require('ioredis');
      const RedisCtor =
        ioredisMod?.default ?? ioredisMod?.Redis ?? ioredisMod;
      const client = new RedisCtor(process.env.REDIS_URL, {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
        lazyConnect: false,
      });
      client.on?.('error', (err: Error) => {
        logger.warn(
          { err: err.message },
          'rate-limit: redis client error (middleware will fall back to in-memory)',
        );
      });
      logger.info('rate-limit: using Redis-backed distributed limiter');
      return createRateLimitMiddleware({
        redis: client,
        logger: {
          warn: (meta, msg) => logger.warn(meta as object, msg),
        },
      });
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'rate-limit: failed to initialize Redis limiter — using in-memory',
      );
      return rateLimitMiddleware();
    }
  })()
);

// Health check — both /health (legacy) and /healthz (k8s-style) are served.
// Returns `{ status, version, service, timestamp, upstreams }` per the
// shared contract in @bossnyumba/observability. Deep probes live at
// /api/v1/health/deep (admin-only, cached 15s).
const healthHandler = async (
  _req: express.Request,
  res: express.Response,
): Promise<void> => {
  if (isShuttingDown) {
    res.status(503).json({
      status: 'shutting_down',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  const payload = {
    status: 'ok' as const,
    version: process.env.APP_VERSION ?? 'dev',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    upstreams: {
      deep: {
        status: 'ok' as const,
        note: 'see GET /api/v1/health/deep for upstream cascade',
      },
    },
  };
  res.json(payload);
};
app.get('/health', healthHandler);
app.get('/healthz', healthHandler);

// API v1 - Hono routes
// FIXED C-1 production startup guard: refuses to boot if API keys aren't configured.
assertApiKeyConfig();

// ----------------------------------------------------------------------------
// Composition root — build service registry once at startup.
//
// The registry is a single typed bag of domain services (marketplace,
// waitlist, negotiation, gamification, migration, etc.). It is lazily
// instantiated: when DATABASE_URL is unset it returns a degraded
// skeleton of all-nulls and routers fall back to 503. When the URL is
// set, real Postgres-backed services are constructed and pure-DB
// endpoints start returning real rows.
// ----------------------------------------------------------------------------
let serviceRegistry: ServiceRegistry;
try {
  serviceRegistry = buildServices({ db: getDb() });
  if (serviceRegistry.isLive) {
    logger.info('service-registry: live (Postgres-backed domain services wired)');
  } else {
    logger.warn(
      'service-registry: degraded (DATABASE_URL unset — pure-DB endpoints will 503)'
    );
  }
} catch (err) {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    'service-registry: initialization failed, falling back to degraded mode'
  );
  serviceRegistry = buildServices({ db: null });
}

// Wave 12 — heartbeat engine + Wave 27 Agent F risk-recompute dispatcher.
// Constructed here (ahead of the api routes) because the risk-recompute
// router needs accessors to the dispatcher + in-memory job tracker the
// supervisor owns. The supervisor is inert until `.start()` is called
// further down the boot sequence, so constructing it early is safe.
const heartbeatSupervisor = createHeartbeatSupervisor(
  serviceRegistry,
  logger,
  30_000,
);

// Wave 26 Agent Z4 — boot-time observability for the three AI-brain
// utilities. Each line tells operators at a glance whether the feature
// is active without hunting through a tenant-request log.
logger.info(
  {
    llmRouter: serviceRegistry.llmRouter ? 'live' : 'null',
    budgetGuardedAnthropic: serviceRegistry.buildBudgetGuardedAnthropicClient
      ? 'live'
      : 'null',
    aiCostLedger: serviceRegistry.aiCostLedger ? 'live' : 'null',
    providers: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    },
  },
  'ai-brain-utilities wired',
);

// Wire the org-awareness query-organization skill into the Brain registry.
// The brain factory (ai-chat.router / brain.hono) reads these extra skills
// when it constructs per-tenant Brains, so Mr. Mwikila can answer
// "show me my bottlenecks" / "how has arrears resolution improved" via
// the same chat surface as every other skill.
try {
  const queryService = serviceRegistry.orgAwareness.queryService;
  const orgSkill = buildQueryOrganizationTool({
    async answer(req) {
      return queryService.answer(req);
    },
  });
  setBrainExtraSkills([orgSkill]);
  logger.info('brain-extensions: org.query_organization skill wired');
} catch (err) {
  logger.warn(
    { err: err instanceof Error ? err.message : String(err) },
    'brain-extensions: failed to wire org skill (non-fatal)'
  );
}

// Deep health cascade — admin-only; probes every upstream with 15s cache.
// Mounted on the Express app so probes can use the serviceRegistry that
// was just built above without crossing into Hono's sub-app.
const deepHealthHandler = createDeepHealthHandler({
  version: process.env.APP_VERSION ?? 'dev',
  cacheMs: Number(process.env.DEEP_HEALTH_CACHE_MS ?? '15000') || 15_000,
  requireAdmin: (req) => {
    const roleHeader = req.header('x-user-role');
    if (roleHeader === 'TENANT_ADMIN' || roleHeader === 'PLATFORM_ADMIN') return true;
    return process.env.NODE_ENV !== 'production';
  },
  probes: [
    postgresProbe(async () => {
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
      // Use postgres-js directly for the probe — drizzle's `.execute()`
      // surface shape drifted across 0.36/0.37 and the wrapper wasn't
      // worth the complexity. This hits the DB wire with a trivial
      // `SELECT 1` and closes the connection.
      const { default: postgres } = await import('postgres');
      const sql = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 2 });
      try {
        const rows = await sql`SELECT 1 as ok`;
        if (rows[0]?.ok !== 1) throw new Error('unexpected row');
      } finally {
        await sql.end({ timeout: 1 });
      }
    }),
    redisProbe(async () => {
      if (!process.env.REDIS_URL) throw new Error('REDIS_URL not set');
      // ioredis is a gateway dep. Named export shape under ESM varies;
      // guard for both default + named, pick whichever is constructable.
      const ioredis = await import('ioredis');
      const RedisCtor =
        (ioredis as unknown as { default?: new (...a: never[]) => unknown })
          .default ??
        (ioredis as unknown as { Redis?: new (...a: never[]) => unknown })
          .Redis ??
        (ioredis as unknown as new (...a: never[]) => unknown);
      const client = new (RedisCtor as new (url: string, opts: unknown) => {
        connect: () => Promise<void>;
        ping: () => Promise<string>;
        disconnect: () => void;
      })(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 1_000,
        lazyConnect: true,
      });
      try {
        await client.connect();
        const pong = await client.ping();
        if (pong !== 'PONG') throw new Error(`unexpected ping: ${pong}`);
      } finally {
        client.disconnect();
      }
    }),
    anthropicProbe(process.env.ANTHROPIC_API_KEY),
    openaiProbe(process.env.OPENAI_API_KEY),
    elevenLabsProbe(process.env.ELEVENLABS_API_KEY),
    gepgProbe(process.env.GEPG_HEALTH_URL),
  ],
});
app.get('/api/v1/health/deep', (req, res) => {
  void deepHealthHandler(req, res);
});

const api = new Hono();
// Wave 12 — Metrics middleware runs first so it captures the full
// latency of every downstream handler + middleware.
api.use('*', createMetricsMiddleware());
// FIXED H-2: apply tenant-isolation enforcement globally on all /api/v1/* routes.
// Auth middleware still runs first per-router; this is a defense-in-depth layer.
api.use('*', ensureTenantIsolation);
// Inject the service registry + flat tenantId/userId into the request ctx
// so 22 new routers can pull real service instances out of the context.
api.use('*', createServiceContextMiddleware(serviceRegistry));
// Wave 12 — Ambient brain observer. Records a behaviour event on every
// authed request so stalls/errors can bubble up into proactive
// interventions. Shared observer instance passed to the middleware so
// subscribers persist across requests.
const behaviorObserver = createAmbientBehaviorObserver();
api.use('*', createAmbientBrainMiddleware(behaviorObserver, logger));
api.route('/auth', authRouter);
api.route('/auth/mfa', authMfaRouter);
api.route('/tenants', tenantsRouter);
api.route('/users', usersRouter);
api.route('/properties', propertiesRouter);
api.route('/units', unitsRouter);
api.route('/customers', customersRouter);
api.route('/leases', leasesRouter);
api.route('/invoices', invoicesApp);
api.route('/payments', paymentsApp);
api.route('/work-orders', workOrdersRouter);
api.route('/vendors', vendorsRouter);
api.route('/notifications', notificationsRouter);
api.route('/reports', reportsHonoRouter);
api.route('/dashboard', dashboardRouter);
api.route('/onboarding', onboardingRouter);
api.route('/feedback', feedbackRouter);
api.route('/complaints', complaintsRouter);
api.route('/inspections', inspectionsRouter);
api.route('/documents', documentsHonoRouter);
api.route('/scheduling', schedulingRouter);
api.route('/messaging', messagingRouter);
api.route('/cases', casesRouter);
api.route('/brain', brainRouter);
api.route('/maintenance', maintenanceRouter);
api.route('/hr', hrRouter);
api.route('/customer', customerAppRouter);
api.route('/owner', ownerPortalRouter);
api.route('/manager', estateManagerAppRouter);
api.route('/admin', adminPortalRouter);
// Wave 1-2 feature routers
api.route('/applications', applicationsRouter);
api.route('/arrears', arrearsRouter);
api.route('/compliance', complianceRouter);
api.route('/compliance-plugins', compliancePluginsRouter);
api.route('/doc-chat', docChatRouter);
api.route('/document-render', documentRenderRouter);
api.route('/financial-profile', financialProfileRouter);
api.route('/gamification', gamificationRouter);
api.route('/gepg', gepgRouter);
api.route('/interactive-reports', interactiveReportsRouter);
api.route('/letters', lettersRouter);
api.route('/marketplace', marketplaceRouter);
// Routers built via factory — inject real services from the composition root
// where available. For services that aren't yet wired, the factory gracefully
// returns a 503/501 to the client rather than a synchronous throw — a pilot
// can hit the endpoint, see the reason, and continue.
const migrationRouter = createMigrationRouter({
  getService: (_tenantId: string) => {
    const svc = serviceRegistry.migration;
    if (!svc) {
      throw Object.assign(
        new Error('MigrationService unavailable — DATABASE_URL not configured'),
        { statusCode: 503 }
      );
    }
    return svc;
  },
});
// Notification preferences — the real store lives in the notifications
// service; until the HTTP binding lands we return the posted shape
// verbatim so clients can dev against a stable surface.
const notificationPreferencesRouter = createNotificationPreferencesRouter({
  getPreferences: () => ({ channels: {}, templates: {}, quietHoursStart: null, quietHoursEnd: null }),
  upsertPreferences: (_u, _t, input) => input,
});
// Webhooks terminate here and forward deliveries via the same event bus
// the rest of the services use, so a downstream subscriber in the
// notifications service can persist status updates.
const notificationWebhooksRouter = createNotificationWebhookRouter({
  onDeliveryStatus: async (update) => {
    try {
      await serviceRegistry.eventBus.publish({
        event: {
          eventId: `webhook_${Date.now()}`,
          eventType: 'NotificationDeliveryStatus',
          timestamp: new Date().toISOString(),
          tenantId: 'system',
          correlationId: `wh_${Date.now()}`,
          causationId: null,
          metadata: {},
          payload: update,
        } as unknown as never,
        version: 1,
        aggregateId: update.providerMessageId ?? 'unknown',
        aggregateType: 'NotificationDelivery',
      });
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'notification-webhook: failed to publish delivery status'
      );
    }
  },
});
api.route('/migration', migrationRouter);
api.route('/negotiations', negotiationsRouter);
api.route('/me/notification-preferences', notificationPreferencesRouter);
api.route('/notification-webhooks', notificationWebhooksRouter);
api.route('/occupancy-timeline', occupancyTimelineRouter);
api.route('/renewals', renewalsRouter);
api.route('/risk-reports', riskReportsRouter);
api.route('/scans', scansRouter);
api.route('/station-master-coverage', stationMasterCoverageRouter);
api.route('/tenders', tendersRouter);
api.route('/waitlist', waitlistRouter);
// Wave 8 — warehouse stock (S7), maintenance taxonomy (S7), IoT observations (S3)
api.route('/warehouse', warehouseRouter);
api.route('/maintenance-taxonomy', maintenanceTaxonomyRouter);
api.route('/iot', iotRouter);
api.route('/lpms', lpmsRouter);
// Wave 9 — feature flags, GDPR right-to-be-forgotten, AI cost ledger.
api.route('/feature-flags', featureFlagsRouter);
api.route('/gdpr', gdprRouter);
api.route('/ai-costs', aiCostsRouter);
// Wave 12 — metrics snapshot for SystemHealth page
api.route('/metrics', metricsRouter);
// Wave 12 — MCP server mounted for Claude Desktop, GPT, Cursor, partner agents
api.route('/mcp', mcpRouter);
// A2A Agent Card — expose under /api/v1/.well-known/agent.json (the standard
// .well-known/ path would require mounting at the express root; this variant
// is still discoverable by A2A clients that follow our OpenAPI spec).
api.route('/.well-known/agent.json', agentCardRouter);
// Wave 11 — public marketing (Mr. Mwikila, unauthenticated) + AI workflow engine
api.route('/public', publicMarketingRouter);
api.route('/public/sandbox', publicSandboxRouter);
api.route('/public/leads', publicLeadsRouter);
// Streaming AI chat — POST /api/v1/ai/chat with SSE response
api.route('/ai', aiChatRouter);
api.route('/workflows', workflowsRouter);
api.route('/agent-certifications', agentCertificationsRouter);
api.route('/classroom', classroomRouter);
api.route('/training', trainingRouter);
api.route('/voice', voiceRouter);
// Wave 13 — Autonomous Department Mode
api.route('/exceptions', exceptionsRouter);
api.route('/audit', autonomousActionsAuditRouter);
api.route('/autonomy', autonomyRouter);
// Wave 28 Phase A Agent PhA2 — monthly bookkeeping close.
api.route('/monthly-close', monthlyCloseRouter);
// Organizational Awareness — "talk to your organization" endpoints
api.route('/org', orgAwarenessRouter);
// Tenant Credit Rating — FICO-scale credit + portable certificate
api.route('/credit-rating', creditRatingRouter);
// Property Grading — Mr. Mwikila's A–F report card system
api.route('/property-grading', propertyGradingRouter);
// AI-Native suite — Agent PhG: sentiment, market surveillance, multimodal,
// polyglot support, predictive interventions, policy simulator, NL query.
api.route('/ai-native', aiNativeRouter);
// Wave 26 — Agent Z2: four repos Agent T flagged with zero router wiring.
api.route('/subleases', subleaseRouter);
api.route('/damage-deductions', damageDeductionsRouter);
api.route('/conditional-surveys', conditionalSurveysRouter);
api.route('/far', farRouter);
// Wave 26 Z3 — Move-out checklist + Approval workflow.
api.route('/move-out', moveOutRouter);
api.route('/approvals', approvalsRouter);
// Wave 27 PhA1 — Vacancy-to-Lease orchestrator (state machine + pipeline runs)
api.route('/vacancy-pipeline', vacancyPipelineRouter);
// Phase B Wave 30 — Task-Agents (narrow-scope single-job agents + manual runs)
api.route('/task-agents', taskAgentsRouter);
// Wave 27 Agent E — Tenant Branding (per-tenant AI persona identity)
api.route('/tenant-branding', tenantBrandingRouter);
// Wave 27 Agent C — Audit Trail v2 (record / verify / bundle / entries)
api.route('/audit-trail', auditTrailRouter);
// Wave 27 Agent F — Risk-recompute manual trigger. Accessors close over
// the heartbeat supervisor (constructed earlier) so the router returns
// 503 cleanly when the dispatcher is not wired.
api.route(
  '/risk-recompute',
  createRiskRecomputeRouter({
    getDispatcher: () => heartbeatSupervisor.riskDispatcher,
    getJobs: () => heartbeatSupervisor.riskJobs,
  }),
);

// Wave 12 — Webhook DLQ admin router. Mounted at /api/v1/webhooks via
// the factory's own prefix. The factory expects a repository + requeue
// function; we wire Postgres when the registry is live, otherwise the
// endpoints are not registered.
if (serviceRegistry.isLive && serviceRegistry.db) {
  const webhookDlqRouter = createWebhookDlqRouter({
    repository: createPostgresWebhookDeliveryRepository(serviceRegistry.db),
    async requeue(event) {
      try {
        await serviceRegistry.eventBus.publish({
          event: {
            eventId: `webhook_${Date.now()}`,
            eventType: 'WebhookDeliveryQueued',
            timestamp: new Date().toISOString(),
            tenantId: event.tenantId,
            correlationId: `wh_${Date.now()}`,
            causationId: null,
            metadata: {},
            payload: event,
          } as unknown as never,
          version: 1,
          aggregateId: event.deliveryId,
          aggregateType: 'WebhookDelivery',
        });
      } catch (err) {
        logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'webhook-dlq: requeue publish failed',
        );
      }
      return event.deliveryId;
    },
  });
  api.route('/', webhookDlqRouter);
}

// OpenAPI spec + Swagger UI. Mounted AFTER every router so the
// harvester can see them. The spec lives at /api/v1/openapi.json and
// the interactive UI at /api/v1/docs.
const openApiRouter = createOpenApiRouter({
  title: 'BOSSNYUMBA API',
  version: process.env.APP_VERSION ?? '1.0.0',
  description:
    'BOSSNYUMBA multi-tenant property management platform — full HTTP API. ' +
    'Generated from the live gateway at runtime.',
  servers: [
    { url: '/api/v1', description: 'This gateway' },
  ],
  mountedRouters: [
    { prefix: '/auth', app: authRouter, defaultTag: 'auth' },
    { prefix: '/auth/mfa', app: authMfaRouter, defaultTag: 'auth' },
    { prefix: '/tenants', app: tenantsRouter, defaultTag: 'tenants' },
    { prefix: '/users', app: usersRouter, defaultTag: 'users' },
    { prefix: '/properties', app: propertiesRouter, defaultTag: 'properties' },
    { prefix: '/units', app: unitsRouter, defaultTag: 'units' },
    { prefix: '/customers', app: customersRouter, defaultTag: 'customers' },
    { prefix: '/leases', app: leasesRouter, defaultTag: 'leases' },
    { prefix: '/invoices', app: invoicesApp, defaultTag: 'invoices' },
    { prefix: '/payments', app: paymentsApp, defaultTag: 'payments' },
    { prefix: '/work-orders', app: workOrdersRouter, defaultTag: 'work-orders' },
    { prefix: '/vendors', app: vendorsRouter, defaultTag: 'vendors' },
    { prefix: '/notifications', app: notificationsRouter, defaultTag: 'notifications' },
    { prefix: '/reports', app: reportsHonoRouter, defaultTag: 'reports' },
    { prefix: '/dashboard', app: dashboardRouter, defaultTag: 'dashboard' },
    { prefix: '/onboarding', app: onboardingRouter, defaultTag: 'onboarding' },
    { prefix: '/feedback', app: feedbackRouter, defaultTag: 'feedback' },
    { prefix: '/complaints', app: complaintsRouter, defaultTag: 'complaints' },
    { prefix: '/inspections', app: inspectionsRouter, defaultTag: 'inspections' },
    { prefix: '/documents', app: documentsHonoRouter, defaultTag: 'documents' },
    { prefix: '/scheduling', app: schedulingRouter, defaultTag: 'scheduling' },
    { prefix: '/messaging', app: messagingRouter, defaultTag: 'messaging' },
    { prefix: '/cases', app: casesRouter, defaultTag: 'cases' },
    { prefix: '/brain', app: brainRouter, defaultTag: 'brain' },
    { prefix: '/maintenance', app: maintenanceRouter, defaultTag: 'maintenance' },
    { prefix: '/hr', app: hrRouter, defaultTag: 'hr' },
    { prefix: '/customer', app: customerAppRouter, defaultTag: 'bff-customer' },
    { prefix: '/owner', app: ownerPortalRouter, defaultTag: 'bff-owner' },
    { prefix: '/manager', app: estateManagerAppRouter, defaultTag: 'bff-manager' },
    { prefix: '/admin', app: adminPortalRouter, defaultTag: 'bff-admin' },
    { prefix: '/applications', app: applicationsRouter, defaultTag: 'applications' },
    { prefix: '/arrears', app: arrearsRouter, defaultTag: 'arrears' },
    { prefix: '/compliance', app: complianceRouter, defaultTag: 'compliance' },
    { prefix: '/compliance-plugins', app: compliancePluginsRouter, defaultTag: 'compliance-plugins' },
    { prefix: '/doc-chat', app: docChatRouter, defaultTag: 'doc-chat' },
    { prefix: '/document-render', app: documentRenderRouter, defaultTag: 'document-render' },
    { prefix: '/financial-profile', app: financialProfileRouter, defaultTag: 'financial-profile' },
    { prefix: '/gamification', app: gamificationRouter, defaultTag: 'gamification' },
    { prefix: '/gepg', app: gepgRouter, defaultTag: 'gepg' },
    { prefix: '/interactive-reports', app: interactiveReportsRouter, defaultTag: 'interactive-reports' },
    { prefix: '/letters', app: lettersRouter, defaultTag: 'letters' },
    { prefix: '/marketplace', app: marketplaceRouter, defaultTag: 'marketplace' },
    { prefix: '/migration', app: migrationRouter as unknown as Hono, defaultTag: 'migration' },
    { prefix: '/negotiations', app: negotiationsRouter, defaultTag: 'negotiations' },
    { prefix: '/me/notification-preferences', app: notificationPreferencesRouter, defaultTag: 'notifications' },
    { prefix: '/notification-webhooks', app: notificationWebhooksRouter, defaultTag: 'notifications' },
    { prefix: '/occupancy-timeline', app: occupancyTimelineRouter, defaultTag: 'occupancy-timeline' },
    { prefix: '/renewals', app: renewalsRouter, defaultTag: 'renewals' },
    { prefix: '/risk-reports', app: riskReportsRouter, defaultTag: 'risk-reports' },
    { prefix: '/scans', app: scansRouter, defaultTag: 'scans' },
    { prefix: '/station-master-coverage', app: stationMasterCoverageRouter, defaultTag: 'station-master-coverage' },
    { prefix: '/tenders', app: tendersRouter, defaultTag: 'tenders' },
    { prefix: '/waitlist', app: waitlistRouter, defaultTag: 'waitlist' },
    { prefix: '/feature-flags', app: featureFlagsRouter, defaultTag: 'feature-flags' },
    { prefix: '/gdpr', app: gdprRouter, defaultTag: 'gdpr' },
    { prefix: '/ai-costs', app: aiCostsRouter, defaultTag: 'ai-costs' },
    { prefix: '/exceptions', app: exceptionsRouter, defaultTag: 'autonomy' },
    { prefix: '/audit', app: autonomousActionsAuditRouter, defaultTag: 'autonomy' },
    { prefix: '/subleases', app: subleaseRouter, defaultTag: 'subleases' },
    { prefix: '/damage-deductions', app: damageDeductionsRouter, defaultTag: 'damage-deductions' },
    { prefix: '/conditional-surveys', app: conditionalSurveysRouter, defaultTag: 'conditional-surveys' },
    { prefix: '/far', app: farRouter, defaultTag: 'far' },
  ],
});
api.route('/', openApiRouter);

app.use('/api/v1', handle(api));

// API versioning
app.get('/api/v1', (_req, res) => {
  res.json({
    version: '1.0.0',
    endpoints: [
      '/api/v1/auth',
      '/api/v1/auth/mfa',
      '/api/v1/tenants',
      '/api/v1/users',
      '/api/v1/properties',
      '/api/v1/units',
      '/api/v1/customers',
      '/api/v1/leases',
      '/api/v1/invoices',
      '/api/v1/payments',
      '/api/v1/work-orders',
      '/api/v1/vendors',
      '/api/v1/notifications',
      '/api/v1/reports',
      '/api/v1/dashboard',
      '/api/v1/onboarding',
      '/api/v1/feedback',
      '/api/v1/complaints',
      '/api/v1/inspections',
      '/api/v1/documents',
      '/api/v1/scheduling',
      '/api/v1/messaging',
      '/api/v1/cases',
      '/api/v1/brain',
      '/api/v1/maintenance',
      '/api/v1/hr',
      '/api/v1/customer',
      '/api/v1/owner',
      '/api/v1/manager',
      '/api/v1/admin',
    ],
  });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error(err, 'Unhandled error');
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Wave 12 — background scheduler supervisor. Heartbeat supervisor is
// constructed earlier (see the block right after the service-registry
// bootstrap) because the risk-recompute router mounted below needs the
// dispatcher it owns.
const backgroundSupervisor = createBackgroundSupervisor(serviceRegistry, logger);

// Wave 26 — intelligence-history worker (Z4). Runs `createIntelligenceHistoryWorker`
// on a daily cadence so `intelligence_history` snapshots are produced out-of-band
// from the scheduler's tenant loop. The scheduler also registers a
// `recompute_intelligence_history` task per-tenant; this standalone supervisor
// guarantees a run even when the scheduler is disabled.
const intelligenceHistorySupervisor = createIntelligenceHistorySupervisor(
  serviceRegistry.db,
  {
    info: (meta, msg) => logger.info(meta, msg),
    warn: (meta, msg) => logger.warn(meta, msg),
  },
);
// Wave 26 — Cases SLA worker supervisor. Wraps the per-tenant
// CaseSLAWorker (domain-services/cases/sla-worker.ts) in a multi-tenant
// supervisor that ticks active tenants every 5 minutes, auto-escalating
// overdue cases and emitting CaseSLABreached events once the ceiling is
// hit. No-op in degraded mode.
const casesSlaSupervisor = createCaseSLASupervisor(serviceRegistry, logger);

// Graceful shutdown — documented and tested step-by-step:
//  1. Flip a "shutting down" flag so the /health probe returns 503.
//  2. Tell the HTTP server to stop accepting NEW connections.
//  3. Stop background workers (outbox, heartbeat, scheduler).
//  4. Wait for in-flight requests to drain (server.close()).
//  5. Close DB + Redis (best-effort).
//  6. Exit 0. Force-exit after 10s if drain hangs.
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'shutdown: signal received — starting drain');

  // Step 2 — server.close() stops accepting new requests and calls the
  // callback once every in-flight request has completed. Start the
  // force-kill timer in parallel so a hung request can't pin the process.
  const forceExit = setTimeout(() => {
    logger.error('shutdown: forced exit after 10s drain timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref?.();

  // Step 3 — stop every background producer before closing sockets so
  // they don't race against a closed pool.
  try {
    stopOutboxWorker();
    logger.info('shutdown: outbox worker stopped');
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'shutdown: outbox stop failed');
  }
  try {
    heartbeatSupervisor.stop();
    logger.info('shutdown: heartbeat supervisor stopped');
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'shutdown: heartbeat stop failed');
  }
  try {
    backgroundSupervisor.stop();
    logger.info('shutdown: background supervisor stopped');
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'shutdown: background stop failed');
  }
  try {
    intelligenceHistorySupervisor.stop();
    logger.info('shutdown: intelligence-history supervisor stopped');
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'shutdown: intelligence-history stop failed');
  }
  try {
    casesSlaSupervisor.stop();
    logger.info('shutdown: cases SLA supervisor stopped');
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'shutdown: cases SLA stop failed');
  }

  // Step 4 — close the HTTP server. Wrapped in a promise so we can
  // await the drain completion.
  await new Promise<void>((resolveDrain) => {
    if (!server) { resolveDrain(); return; }
    server.close(() => { resolveDrain(); });
  });
  logger.info('shutdown: server drained (no in-flight requests)');

  // Step 5 — close DB + Redis. The drizzle client doesn't expose .end()
  // directly; the underlying postgres-js client does. Best-effort only.
  try {
    const maybeClient = (serviceRegistry.db as unknown as {
      $client?: { end?: () => Promise<void> };
    })?.$client;
    if (maybeClient?.end) {
      await maybeClient.end();
      logger.info('shutdown: postgres pool closed');
    }
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'shutdown: postgres close failed');
  }

  clearTimeout(forceExit);
  logger.info('shutdown: complete, exiting 0');
  process.exit(0);
}

let server: ReturnType<typeof app.listen> | null = null;

// Start server
if (require.main === module) {
  // Initialize Sentry + PostHog analytics at boot — no-ops when DSN/key absent.
  void import('@bossnyumba/observability').then(async (obs) => {
    if (obs.initSentry && obs.installGlobalSentryHandlers) {
      await obs.initSentry({
        dsn: process.env.SENTRY_DSN,
        service: 'api-gateway',
        environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
        release: process.env.GIT_SHA,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      });
      obs.installGlobalSentryHandlers();
    }
    if (obs.initAnalytics) {
      await obs.initAnalytics({
        apiKey: process.env.POSTHOG_API_KEY,
        host: process.env.POSTHOG_HOST,
        service: 'api-gateway',
        environment: process.env.NODE_ENV,
      });
    }
  }).catch((err) => {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'sentry/analytics init failed');
  });

  server = app.listen(port, () => {
    logger.info({ port }, 'API Gateway started');
  });

  // Wave 12 — start heartbeat + background scheduler after the server
  // is listening. Both are gated by DATABASE_URL internally; degraded
  // mode skips the supervisors gracefully.
  heartbeatSupervisor.start();
  backgroundSupervisor.start();
  intelligenceHistorySupervisor.start();
  // Wave 26 — start the Cases SLA supervisor alongside the other
  // background workers. Skipped in tests + when disabled by env.
  casesSlaSupervisor.start();

  // Start the outbox drainer + register domain-event subscribers. The
  // outbox publishes events into the in-process bus; the subscribers
  // turn those events into customer-visible outcomes (notifications,
  // audit entries). Runner is resolved lazily via the observability
  // event-bus singleton so tests can stub it out.
  void import('@bossnyumba/observability').then((obs) => {
    // Initialize the event-bus singleton first; getEventBus() throws
    // if called without a config on first use. Config is idempotent
    // across calls (the module memoises the first instance).
    let runner: OutboxRunnerLike | undefined;
    try {
      runner = obs.getEventBus?.({
        serviceName: 'api-gateway',
        enableOutbox: true,
      } as unknown as never) as unknown as OutboxRunnerLike | undefined;
    } catch (e) {
      runner = undefined;
      logger.warn({ err: e instanceof Error ? e.message : String(e) }, 'observability: getEventBus init failed');
    }
    if (!runner) {
      runner = (obs as unknown as { eventBus?: OutboxRunnerLike }).eventBus;
    }
    if (runner && typeof (runner as OutboxRunnerLike).processOutbox === 'function') {
      startOutboxWorker(runner as OutboxRunnerLike, {
        logger,
        enabled: process.env.NODE_ENV !== 'test' && process.env.OUTBOX_WORKER_DISABLED !== 'true',
        intervalMs: Number(process.env.OUTBOX_INTERVAL_MS || '5000') || 5000,
        batchSize: Number(process.env.OUTBOX_BATCH_SIZE || '50') || 50,
      });
    } else {
      logger.warn('outbox worker: event bus runner not available; worker not started');
    }

    // Register event subscribers. Same bus reference as the outbox
    // drainer so subscribers receive events the drainer publishes.
    const subscribableBus = runner as unknown as SubscribableBus | undefined;
    if (subscribableBus && typeof subscribableBus.subscribe === 'function') {
      // Minimal HTTP-based notification dispatcher. Posts to the
      // notifications service; a future iteration can swap this for
      // an in-process transport when services are co-deployed.
      const notificationsUrl = process.env.NOTIFICATIONS_SERVICE_URL?.trim();
      const dispatcher: NotificationDispatcher = {
        async send(params) {
          if (!notificationsUrl) {
            // No configured notifications service — log the dispatch so
            // operators see what would have been sent without crashing.
            logger.info({ params }, 'notification dispatch skipped (NOTIFICATIONS_SERVICE_URL unset)');
            return { success: true };
          }
          try {
            const res = await fetch(`${notificationsUrl.replace(/\/$/, '')}/send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(process.env.INTERNAL_API_KEY ? { 'X-Internal-Key': process.env.INTERNAL_API_KEY } : {}),
              },
              body: JSON.stringify(params),
            });
            if (!res.ok) {
              const text = await res.text().catch(() => '');
              return { success: false, error: `${res.status}: ${text.slice(0, 200)}` };
            }
            return { success: true };
          } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        },
      };
      // Wave 18 — pass the arrears service through so InvoiceOverdue
      // events open real cases instead of just logging a metric.
      registerDomainEventSubscribers({
        bus: subscribableBus,
        notifications: dispatcher,
        logger,
        arrearsService: serviceRegistry.arrears?.service ?? null,
      });

      // Wave 19 — bridge the domain bus onto the observability bus.
      // Domain services publish through `InMemoryEventBus` (the
      // composition-root bus wired into every service constructor).
      // The api-gateway subscribers registered above attach to the
      // observability `EventBus`. Without this bridge the two buses
      // are disjoint and every domain event is silently dropped.
      //
      // The forwarder flattens the domain `EventEnvelope` into the
      // observability `DomainEvent<T>` shape — subscribers already
      // fall back to `event.eventType ?? event.type`, so both fields
      // are populated.
      const domainBus = serviceRegistry.eventBus as unknown as {
        addForwarder?: (fwd: (env: unknown) => Promise<void> | void) => () => void;
      } | undefined;
      const obsPublish = (runner as unknown as {
        publish?: (event: unknown) => Promise<void> | void;
      }).publish;
      if (
        domainBus &&
        typeof domainBus.addForwarder === 'function' &&
        typeof obsPublish === 'function'
      ) {
        domainBus.addForwarder(async (envelope) => {
          const env = envelope as {
            event?: {
              eventType?: string;
              eventId?: string;
              tenantId?: string;
              timestamp?: string | Date;
              correlationId?: string;
              metadata?: Record<string, unknown>;
              payload?: Record<string, unknown>;
            };
            aggregateId?: string;
            aggregateType?: string;
          };
          const domainEvent = env.event ?? {};
          const eventType = domainEvent.eventType ?? 'UnknownEvent';
          // Build an observability-shaped DomainEvent. `type` is what
          // the observability pattern-matcher and api-gateway
          // subscribers key off of.
          await obsPublish.call(runner, {
            id: domainEvent.eventId ?? `evt_${Date.now()}`,
            type: eventType,
            eventType, // keep both for subscriber fallback
            aggregateType: env.aggregateType ?? 'Unknown',
            aggregateId: env.aggregateId ?? 'unknown',
            timestamp: domainEvent.timestamp ?? new Date(),
            timestampMs: Date.now(),
            version: 1,
            payload: domainEvent.payload ?? {},
            metadata: {
              sourceService: 'domain-services',
              tenantId: domainEvent.tenantId,
              correlationId: domainEvent.correlationId,
              ...(domainEvent.metadata ?? {}),
            },
          });
        });
        logger.info('event-bus bridge: domain bus → observability bus wired');
      } else {
        logger.warn(
          'event-bus bridge: forwarder unavailable; domain events may not reach api-gateway subscribers',
        );
      }
    } else {
      logger.warn('event subscribers: bus.subscribe not available; subscribers not registered');
    }
  }).catch((err) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'failed to load observability for outbox worker');
  });

  process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
  process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });
}

export default app;
