/**
 * Field capture routes.
 *
 *   POST /v1/field/capture/photo       (JSON body — base64 OR storageUri + location)
 *   POST /v1/field/capture/video       (JSON body)
 *   POST /v1/field/capture/audio       (JSON body)
 *   POST /v1/field/capture/inspection  (JSON checklist response)
 *   POST /v1/field/capture/sync        (bulk array)
 *   GET  /v1/field/queue/:surveyorId   (captures still pending)
 *   POST /v1/field/parcels/:id/polygon (submit a captured polygon)
 *
 * Wrapped in `withSecurityEventsFastify`. Idempotency-Key required for
 * POSTs (header is validated; routes are functionally idempotent
 * keyed by it).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { withSecurityEventsFastify } from '@bossnyumba/observability';
import {
  createCapturePipeline,
  defaultAiInference,
  type CaptureStore,
  type FieldCaptureInput,
} from '@bossnyumba/geo-intelligence';

const CapturePayloadSchema = z.object({
  kind: z.enum(['photo', 'video', 'audio', 'inspection', 'polygon', 'sensor', 'drone', 'pano']),
  parcelId: z.string().optional(),
  capturedAt: z.string().datetime().optional(),
  capturedLocation: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    ts: z.string().optional(),
    deviceModel: z.string().optional(),
    altitudeM: z.number().optional(),
  }).optional(),
  storageUri: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  // base64 payload for inline uploads (small only). Production prefers
  // a pre-signed S3 PUT + storageUri.
  bytesBase64: z.string().optional(),
});

const SyncBodySchema = z.object({
  surveyorUserId: z.string().min(1),
  tenantId: z.string().min(1),
  captures: z.array(CapturePayloadSchema).min(1).max(200),
});

const SingleSubmitBodySchema = CapturePayloadSchema.extend({
  surveyorUserId: z.string().min(1),
  tenantId: z.string().min(1),
});

const PolygonSubmitBodySchema = z.object({
  surveyorUserId: z.string().min(1),
  tenantId: z.string().min(1),
  capturedAt: z.string().datetime().optional(),
  geometry: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(
      z.array(z.tuple([z.number(), z.number()])),
    ).min(1),
  }),
  metadata: z.record(z.unknown()).optional(),
});

function decodeBase64ToBytes(b64?: string): Uint8Array | undefined {
  if (!b64) return undefined;
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function requireIdempotencyKey(headers: Record<string, unknown> | undefined): string | null {
  const key = headers?.['idempotency-key'] ?? headers?.['Idempotency-Key'];
  if (typeof key !== 'string' || key.length < 8) return null;
  return key;
}

function toCaptureInput(payload: z.infer<typeof CapturePayloadSchema>): FieldCaptureInput {
  const bytes = decodeBase64ToBytes(payload.bytesBase64);
  return {
    kind: payload.kind,
    ...(payload.parcelId !== undefined ? { parcelId: payload.parcelId } : {}),
    ...(payload.capturedAt !== undefined ? { capturedAt: payload.capturedAt } : {}),
    ...(payload.capturedLocation !== undefined ? { capturedLocation: payload.capturedLocation } : {}),
    ...(payload.storageUri !== undefined ? { storageUri: payload.storageUri } : {}),
    ...(bytes !== undefined ? { bytes } : {}),
    ...(payload.metadata !== undefined ? { metadata: payload.metadata } : {}),
  };
}

export interface CaptureRoutesDeps {
  readonly store: CaptureStore;
}

export async function registerCaptureRoutes(
  app: FastifyInstance,
  deps: CaptureRoutesDeps,
): Promise<void> {
  const pipeline = createCapturePipeline({
    store: deps.store,
    aiInference: defaultAiInference(),
  });

  // ------------------------------------------------------------------
  // Single-kind submit endpoints (photo / video / audio / inspection)
  // ------------------------------------------------------------------
  const singleHandler = (forceKind: 'photo' | 'video' | 'audio' | 'inspection') =>
    async (
      request: { readonly body?: unknown; readonly headers?: Record<string, unknown> },
      reply: { code: (n: number) => unknown; send: (b: unknown) => unknown },
    ) => {
      const idemKey = requireIdempotencyKey(request.headers ?? {});
      if (!idemKey) {
        reply.code(400);
        return { error: 'idempotency-key header required (>= 8 chars)' };
      }
      const parsed = SingleSubmitBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'invalid request body', details: parsed.error.flatten() };
      }
      const { surveyorUserId, tenantId, ...payload } = parsed.data;
      // Force the kind to match the route.
      const forcedPayload = { ...payload, kind: forceKind } as z.infer<typeof CapturePayloadSchema>;
      const result = await pipeline.submitFieldCapture({
        surveyorUserId,
        tenantId,
        captures: [toCaptureInput(forcedPayload)],
      });
      reply.code(201);
      return { idempotencyKey: idemKey, captures: result };
    };

  app.post('/v1/field/capture/photo', withSecurityEventsFastify(
    { action: 'field.capture.photo', resource: 'capture', severity: 'info' },
    singleHandler('photo'),
  ));

  app.post('/v1/field/capture/video', withSecurityEventsFastify(
    { action: 'field.capture.video', resource: 'capture', severity: 'info' },
    singleHandler('video'),
  ));

  app.post('/v1/field/capture/audio', withSecurityEventsFastify(
    { action: 'field.capture.audio', resource: 'capture', severity: 'info' },
    singleHandler('audio'),
  ));

  app.post('/v1/field/capture/inspection', withSecurityEventsFastify(
    { action: 'field.capture.inspection', resource: 'capture', severity: 'info' },
    singleHandler('inspection'),
  ));

  // ------------------------------------------------------------------
  // Bulk sync
  // ------------------------------------------------------------------
  app.post('/v1/field/capture/sync', withSecurityEventsFastify(
    { action: 'field.capture.sync', resource: 'capture', severity: 'info' },
    async (request, reply) => {
      const idemKey = requireIdempotencyKey((request.headers ?? {}) as Record<string, unknown>);
      if (!idemKey) {
        reply.code(400);
        return { error: 'idempotency-key header required (>= 8 chars)' };
      }
      const parsed = SyncBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'invalid sync body', details: parsed.error.flatten() };
      }
      const { surveyorUserId, tenantId, captures } = parsed.data;
      const result = await pipeline.submitFieldCapture({
        surveyorUserId,
        tenantId,
        captures: captures.map(toCaptureInput),
      });
      reply.code(202);
      return {
        idempotencyKey: idemKey,
        accepted: result.length,
        captures: result,
      };
    },
  ));

  // ------------------------------------------------------------------
  // Queue inspection (read)
  // ------------------------------------------------------------------
  app.get('/v1/field/queue/:surveyorId', async (request, reply) => {
    const { surveyorId } = request.params as { surveyorId: string };
    if (!surveyorId || typeof surveyorId !== 'string') {
      reply.code(400);
      return { error: 'invalid surveyorId' };
    }
    const queued = deps.store.listForSurveyor(surveyorId, 'queued');
    const processed = deps.store.listForSurveyor(surveyorId, 'processed');
    return { surveyorId, queued, processed };
  });

  // ------------------------------------------------------------------
  // Submit captured polygon for an existing parcel
  // ------------------------------------------------------------------
  app.post('/v1/field/parcels/:id/polygon', withSecurityEventsFastify(
    { action: 'field.parcel.polygon', resource: 'parcel', severity: 'info' },
    async (request, reply) => {
      const idemKey = requireIdempotencyKey((request.headers ?? {}) as Record<string, unknown>);
      if (!idemKey) {
        reply.code(400);
        return { error: 'idempotency-key header required (>= 8 chars)' };
      }
      const { id } = request.params as { id: string };
      const parsed = PolygonSubmitBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return { error: 'invalid polygon body', details: parsed.error.flatten() };
      }
      const { surveyorUserId, tenantId, geometry, capturedAt, metadata } = parsed.data;
      const result = await pipeline.submitFieldCapture({
        surveyorUserId,
        tenantId,
        parcelId: id,
        captures: [{
          kind: 'polygon',
          parcelId: id,
          ...(capturedAt !== undefined ? { capturedAt } : {}),
          metadata: {
            geometry,
            ...(metadata ?? {}),
          },
        }],
      });
      reply.code(201);
      return { idempotencyKey: idemKey, parcelId: id, captures: result };
    },
  ));
}
