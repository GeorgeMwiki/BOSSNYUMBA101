/**
 * OpenAPI document emitter — SCAFFOLDED 10
 *
 * Exposes `GET /api/v1/openapi.json` assembling the spec from the
 * `@hono/zod-openapi` routers already registered on the gateway. Falls
 * back to a minimal hand-rolled stub when the runtime dep isn't yet
 * installed (the scaffold can compile and run even before the dep is
 * added to package.json).
 *
 * When you're ready to wire the richer integration, add
 *     "@hono/zod-openapi": "^0.16.0"
 * to `services/api-gateway/package.json` and swap the handwritten stub
 * for the real `OpenAPIHono` emit.
 */

import { Hono } from 'hono';

export interface OpenApiDocumentOptions {
  title?: string;
  version?: string;
  description?: string;
  servers?: Array<{ url: string; description?: string }>;
}

/** Minimal spec scaffold — structurally valid, ready to be grown by
 *  declarative route registrations. */
export function buildStubOpenApiSpec(
  options: OpenApiDocumentOptions = {}
): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: options.title ?? 'BOSSNYUMBA API',
      version: options.version ?? '0.1.0',
      description:
        options.description ??
        'BOSSNYUMBA platform API — multi-tenant property management SaaS.',
    },
    servers: options.servers ?? [
      { url: '/api/v1', description: 'Default relative base path' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorEnvelope: {
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
          required: ['error'],
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/me/notification-preferences': {
        get: {
          summary: 'Get current user notification preferences',
          tags: ['notifications'],
          responses: {
            '200': {
              description: 'Preferences returned',
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
        put: {
          summary: 'Upsert current user notification preferences',
          tags: ['notifications'],
          responses: {
            '200': { description: 'Updated preferences returned' },
            '400': {
              description: 'Validation error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Try to use `@hono/zod-openapi`'s `OpenAPIHono` if installed; else stub.
 *
 * The returned router exposes GET `/openapi.json` at whatever path the
 * caller mounts it on (typically `/api/v1`).
 */
export async function createOpenApiRouter(
  options: OpenApiDocumentOptions = {}
): Promise<Hono> {
  const app = new Hono();
  let spec: Record<string, unknown> = buildStubOpenApiSpec(options);

  try {
    // Optional runtime dep — if present, use it for real schema introspection.
    const mod = (await import('@hono/zod-openapi')) as unknown as {
      OpenAPIHono?: new (...args: unknown[]) => {
        getOpenAPIDocument(doc: Record<string, unknown>): Record<string, unknown>;
      };
    };
    if (mod.OpenAPIHono) {
      const gen = new mod.OpenAPIHono();
      spec = gen.getOpenAPIDocument({
        openapi: '3.1.0',
        info: {
          title: options.title ?? 'BOSSNYUMBA API',
          version: options.version ?? '0.1.0',
        },
      });
    }
  } catch {
    // Dep missing — stick with the stub.
  }

  app.get('/openapi.json', (c) => c.json(spec));
  return app;
}
