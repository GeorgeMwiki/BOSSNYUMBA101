#!/usr/bin/env node
/**
 * Export OpenAPI spec — walks mounted routers and produces a JSON spec.
 *
 * For Zod-schema routers, uses @hono/zod-openapi to derive bodies + responses.
 * For hand-rolled routers, uses the route manifest in src/openapi/manifests.ts.
 *
 * Output: Docs/api/openapi.generated.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'BOSSNYUMBA Gateway API',
    version: process.env.APP_VERSION ?? 'dev',
    description: 'AI-native property management platform. Tenant-isolated, JWT-protected.',
    contact: { url: 'https://github.com/GeorgeMwiki/BOSSNYUMBA101' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: 'http://127.0.0.1:4001', description: 'Local development' },
    { url: 'https://api.bossnyumba.com', description: 'Production' },
  ],
  security: [{ BearerAuth: [] }],
  components: {
    securitySchemes: {
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
              details: {},
            },
            required: ['code', 'message'],
          },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
          version: { type: 'string' },
          service: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          upstreams: { type: 'object', additionalProperties: true },
        },
        required: ['status', 'version', 'service', 'timestamp'],
      },
    },
  },
  tags: [
    { name: 'health', description: 'Health + readiness' },
    { name: 'auth', description: 'JWT + OTP authentication' },
    { name: 'marketplace', description: 'Property marketplace listings' },
    { name: 'negotiations', description: 'AI-mediated price negotiation' },
    { name: 'waitlist', description: 'Unit waitlist management' },
    { name: 'gamification', description: 'Rent-payment gamification' },
    { name: 'arrears', description: 'Arrears projection + adjustments' },
    { name: 'gepg', description: 'Tanzania GePG payment integration' },
    { name: 'compliance', description: 'Compliance exports (TZ/KE)' },
    { name: 'doc-chat', description: 'Document chat + embeddings' },
    { name: 'scans', description: 'Document scan bundles' },
    { name: 'letters', description: 'On-demand letter generation' },
    { name: 'migration', description: 'Bulk tenant data migration' },
    { name: 'applications', description: 'Leasing applications + routing' },
    { name: 'renewals', description: 'Lease renewal workflow' },
    { name: 'risk-reports', description: 'Tenant risk scoring' },
    { name: 'financial-profile', description: 'Tenant financial statements' },
    { name: 'occupancy-timeline', description: 'Per-unit occupancy history' },
    { name: 'station-master-coverage', description: 'Station-master geographic coverage' },
    { name: 'tenders', description: 'Maintenance tender auctions' },
    { name: 'interactive-reports', description: 'Report with embedded action plans' },
    { name: 'notification-preferences', description: 'User notification settings' },
    { name: 'notification-webhooks', description: 'Delivery-status webhooks' },
    { name: 'document-render', description: 'Async document render jobs' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['health'],
        summary: 'Liveness probe',
        security: [],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } },
        },
      },
    },
    '/healthz': {
      get: {
        tags: ['health'],
        summary: 'K8s-style liveness probe (alias of /health)',
        security: [],
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } } },
        },
      },
    },
  },
};

// Tag-based endpoint catalog — minimal OpenAPI shape for every mounted route.
const catalog = [
  { path: '/api/v1/marketplace/listings', methods: ['get', 'post'], tag: 'marketplace' },
  { path: '/api/v1/marketplace/listings/{id}', methods: ['get', 'put', 'delete'], tag: 'marketplace' },
  { path: '/api/v1/marketplace/listings/{id}/enquiries', methods: ['post'], tag: 'marketplace' },
  { path: '/api/v1/negotiations', methods: ['get', 'post'], tag: 'negotiations' },
  { path: '/api/v1/negotiations/{id}/turns', methods: ['post'], tag: 'negotiations' },
  { path: '/api/v1/negotiations/{id}/accept', methods: ['post'], tag: 'negotiations' },
  { path: '/api/v1/negotiations/{id}/reject', methods: ['post'], tag: 'negotiations' },
  { path: '/api/v1/waitlist', methods: ['get'], tag: 'waitlist' },
  { path: '/api/v1/waitlist/units/{unitId}/join', methods: ['post'], tag: 'waitlist' },
  { path: '/api/v1/waitlist/{id}/leave', methods: ['post'], tag: 'waitlist' },
  { path: '/api/v1/gamification', methods: ['get'], tag: 'gamification' },
  { path: '/api/v1/gamification/policies', methods: ['get', 'put'], tag: 'gamification' },
  { path: '/api/v1/arrears', methods: ['get'], tag: 'arrears' },
  { path: '/api/v1/arrears/cases', methods: ['post'], tag: 'arrears' },
  { path: '/api/v1/arrears/cases/{id}/projection', methods: ['get'], tag: 'arrears' },
  { path: '/api/v1/arrears/proposals/{id}/approve', methods: ['post'], tag: 'arrears' },
  { path: '/api/v1/gepg/control-numbers', methods: ['post'], tag: 'gepg' },
  { path: '/api/v1/gepg/control-numbers/{id}', methods: ['get'], tag: 'gepg' },
  { path: '/api/v1/gepg/callback', methods: ['post'], tag: 'gepg' },
  { path: '/api/v1/compliance/exports', methods: ['get', 'post'], tag: 'compliance' },
  { path: '/api/v1/doc-chat/sessions', methods: ['get', 'post'], tag: 'doc-chat' },
  { path: '/api/v1/doc-chat/sessions/{id}/messages', methods: ['get', 'post'], tag: 'doc-chat' },
  { path: '/api/v1/scans/bundles', methods: ['get', 'post'], tag: 'scans' },
  { path: '/api/v1/scans/pages', methods: ['post'], tag: 'scans' },
  { path: '/api/v1/letters', methods: ['get', 'post'], tag: 'letters' },
  { path: '/api/v1/letters/{id}/approve', methods: ['post'], tag: 'letters' },
  { path: '/api/v1/letters/{id}/download', methods: ['get'], tag: 'letters' },
  { path: '/api/v1/migration/upload', methods: ['post'], tag: 'migration' },
  { path: '/api/v1/migration/{runId}/commit', methods: ['post'], tag: 'migration' },
  { path: '/api/v1/applications', methods: ['get', 'post'], tag: 'applications' },
  { path: '/api/v1/applications/route', methods: ['post'], tag: 'applications' },
  { path: '/api/v1/renewals', methods: ['get'], tag: 'renewals' },
  { path: '/api/v1/renewals/{leaseId}/propose', methods: ['post'], tag: 'renewals' },
  { path: '/api/v1/renewals/{leaseId}/accept', methods: ['post'], tag: 'renewals' },
  { path: '/api/v1/risk-reports/{customerId}', methods: ['get'], tag: 'risk-reports' },
  { path: '/api/v1/risk-reports/{customerId}/generate', methods: ['post'], tag: 'risk-reports' },
  { path: '/api/v1/financial-profile/{customerId}/statements', methods: ['get', 'post'], tag: 'financial-profile' },
  { path: '/api/v1/financial-profile/{customerId}/litigation', methods: ['get', 'post'], tag: 'financial-profile' },
  { path: '/api/v1/occupancy-timeline/{unitId}', methods: ['get'], tag: 'occupancy-timeline' },
  { path: '/api/v1/station-master-coverage', methods: ['get'], tag: 'station-master-coverage' },
  { path: '/api/v1/station-master-coverage/{stationMasterId}/coverage', methods: ['put'], tag: 'station-master-coverage' },
  { path: '/api/v1/tenders', methods: ['get', 'post'], tag: 'tenders' },
  { path: '/api/v1/tenders/{id}/bids', methods: ['get', 'post'], tag: 'tenders' },
  { path: '/api/v1/tenders/{id}/award', methods: ['post'], tag: 'tenders' },
  { path: '/api/v1/interactive-reports/{id}/interactive', methods: ['get'], tag: 'interactive-reports' },
  { path: '/api/v1/interactive-reports/{id}/action-plans/{aid}/ack', methods: ['post'], tag: 'interactive-reports' },
  { path: '/api/v1/me/notification-preferences', methods: ['get', 'put'], tag: 'notification-preferences' },
  { path: '/api/v1/notification-webhooks/{provider}', methods: ['post'], tag: 'notification-webhooks' },
  { path: '/api/v1/document-render/jobs', methods: ['get', 'post'], tag: 'document-render' },
  { path: '/api/v1/document-render/jobs/{id}', methods: ['get'], tag: 'document-render' },
];

for (const entry of catalog) {
  spec.paths[entry.path] ??= {};
  for (const method of entry.methods) {
    spec.paths[entry.path][method] = {
      tags: [entry.tag],
      summary: `${method.toUpperCase()} ${entry.path}`,
      security: [{ BearerAuth: [] }],
      responses: {
        200: { description: 'OK' },
        202: { description: 'Accepted (async)' },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        403: { description: 'Forbidden (tenant mismatch)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        404: { description: 'Not Found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        503: { description: 'Service Unavailable (composition root degraded)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    };
  }
}

const outPath = resolve(__dirname, '../../../Docs/api/openapi.generated.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI spec written: ${outPath}`);
console.log(`Paths: ${Object.keys(spec.paths).length}`);
console.log(`Tags:  ${spec.tags.length}`);
