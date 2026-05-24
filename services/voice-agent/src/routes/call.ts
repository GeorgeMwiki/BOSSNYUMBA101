/**
 * POST /voice/calls/start
 *
 * Mints a fresh session id + WebSocket URL the caller's client uses to push
 * audio frames upstream. This route is intentionally minimal — the actual
 * audio brokering happens on the WS channel; this handler just picks STT /
 * TTS providers up-front so the WS connect handshake can short-circuit.
 *
 * Telephony bridge (Twilio / SIP) is OUT OF SCOPE for this service. A
 * downstream service is expected to convert call legs into the WS protocol
 * described here.
 */

import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { detectLanguage } from '../router/language-router.js';
import { routeStt } from '../router/stt-router.js';
import { routeTts, type LatencyTier } from '../router/tts-router.js';

import { withSecurityEventsFastify } from '@bossnyumba/observability';
const BodySchema = z.object({
  tenantId: z.string().min(1),
  language: z.string().min(1).optional(),
  /** Caller's E.164 phone number, if known. */
  callerE164: z.string().min(1).optional(),
  /** ISO-3166 alpha-2 jurisdiction (defaults to TZ at the persona layer). */
  jurisdiction: z.string().length(2).optional(),
  latencyTier: z.enum(['best-quality', 'low-latency']).optional(),
});

export type StartCallBody = z.infer<typeof BodySchema>;

export interface StartCallResponse {
  readonly sessionId: string;
  readonly wsUrl: string;
  readonly language: string;
  readonly stt: { readonly provider: string; readonly rationale: string };
  readonly tts: { readonly provider: string; readonly rationale: string };
}

export interface CallRouteOptions {
  /**
   * Origin used to build the absolute WebSocket URL returned to the client.
   * Defaults to `ws://${host}:${port}` derived from the request — but in
   * production the gateway / ingress hostname should be passed explicitly so
   * the URL is stable across pod restarts.
   */
  readonly wsBaseUrl?: string;
}

/**
 * Pure helper — exposed for unit tests. Resolves the routing decisions and
 * mints the session metadata without touching the HTTP framework.
 */
export function planCall(
  body: StartCallBody,
  options: { wsBaseUrl: string },
): StartCallResponse {
  const language = detectLanguage(body.language);
  const tier: LatencyTier = body.latencyTier ?? 'best-quality';
  const stt = routeStt(language);
  const tts = routeTts(language, tier);
  const sessionId = randomUUID();
  const wsUrl = `${options.wsBaseUrl.replace(/\/$/, '')}/voice/calls/${sessionId}/stream`;

  return {
    sessionId,
    wsUrl,
    language,
    stt: { provider: stt.provider, rationale: stt.rationale },
    tts: { provider: tts.provider, rationale: tts.rationale },
  };
}

export function registerCallRoute(
  app: FastifyInstance,
  options: CallRouteOptions = {},
): void {
  app.post('/voice/calls/start', withSecurityEventsFastify({ action: 'voice-call.create', resource: 'voice-call', severity: 'info' }, async (request, reply) => {
    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_request', details: parsed.error.flatten() };
    }
    const wsBaseUrl =
      options.wsBaseUrl ??
      // Fall back to the request's protocol + host. WSS upgrades from HTTPS.
      `${request.protocol === 'https' ? 'wss' : 'ws'}://${request.hostname}`;

    const plan = planCall(parsed.data, { wsBaseUrl });
    reply.code(201);
    return plan;
  }));
}
