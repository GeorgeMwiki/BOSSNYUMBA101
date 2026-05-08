/**
 * Voice-agent wiring — composes the conversational `createVoiceAgent`
 * factory from `@bossnyumba/ai-copilot/ai-native` (namespace `VoiceAgent`)
 * with the Drizzle-backed `voice_turns` storage adapter shipped from
 * `@bossnyumba/database` (`createVoiceTurnsService`, migration 0110).
 *
 * STT, TTS, and CustomerResolver ports are intentionally `null` here —
 * production deployment of those adapters lands in a follow-up. The
 * agent itself supports `null` for all three: STT-missing requests fall
 * back to inline transcripts, TTS-missing turns degrade to text-only
 * responses, and an unresolved caller still gets answered (just without
 * personalized context).
 *
 * The `VoiceBrainPort` is wired to a degraded-mode stub that politely
 * signals VOICE_BRAIN_NOT_CONFIGURED in the detected language. The
 * agent is therefore *operable* in production from day one — every
 * turn round-trips through STT-skip → brain-stub → TTS-skip → DB
 * persist — and the platform can swap the brain stub for the real
 * central-intelligence kernel later without re-wiring.
 *
 * Tenant isolation: enforced by the agent's input contract
 * (`tenantId` mandatory on every turn) and by the storage adapter's
 * `tenant_id` column index on every read/write.
 */

import { createDatabaseClient, createVoiceTurnsService } from '@bossnyumba/database';
import { VoiceAgent as VoiceAgentNs } from '@bossnyumba/ai-copilot/ai-native';

/**
 * DatabaseClient + VoiceTurnsService types derived via `ReturnType<typeof
 * factory>` to sidestep the package-barrel namespace/type drift
 * (TS2709) — see `service-registry.ts` and `classroom-wiring.ts` for
 * the full explanation.
 */
type DatabaseClient = ReturnType<typeof createDatabaseClient>;
type VoiceTurnsService = ReturnType<typeof createVoiceTurnsService>;
type VoiceTurnRowShape = Awaited<ReturnType<VoiceTurnsService['list']>>[number];

type VoiceAgent = ReturnType<typeof VoiceAgentNs.createVoiceAgent>;
type VoiceTurnRow = VoiceAgentNs.VoiceTurnRow;
type VoiceTurnRepository = VoiceAgentNs.VoiceTurnRepository;
type VoiceBrainPort = VoiceAgentNs.VoiceBrainPort;
type VoiceBrainResponse = VoiceAgentNs.VoiceBrainResponse;

export interface VoiceAgentWiringDeps {
  readonly db: DatabaseClient | null;
  readonly logger?: { warn(meta: object, msg: string): void };
}

export interface VoiceAgentWiring {
  readonly agent: VoiceAgent;
}

/**
 * Polite degraded-mode reply text per detected language. Operators
 * see `VOICE_BRAIN_NOT_CONFIGURED` in logs; callers hear an apology
 * in their own language. Languages fall back to English.
 */
const DEGRADED_REPLIES: Readonly<Record<string, string>> = Object.freeze({
  en: 'Thanks for calling. The voice service is not yet fully configured here. A team member will follow up.',
  sw: 'Asante kwa kupiga simu. Huduma ya sauti bado haijasanidiwa kikamilifu. Mwanachama wa timu atafuatilia.',
  es: 'Gracias por llamar. El servicio de voz aún no está completamente configurado. Un miembro del equipo lo contactará.',
  fr: 'Merci de votre appel. Le service vocal n’est pas encore entièrement configuré. Un membre de l’équipe vous recontactera.',
});

/**
 * Ultra-light language heuristic — mirrors `heuristicDetect` in the
 * agent so the brain stub picks the same code the agent emits when
 * STT does not provide one. Never hard-code English as the only
 * choice; this is a fallback chain, not a jurisdiction lock.
 */
function detectLanguageFromTranscript(text: string): string {
  const lower = text.toLowerCase();
  if (/(habari|asante|karibu|nyumba|jambo)/.test(lower)) return 'sw';
  if (/\b(hola|gracias|por favor)\b/.test(lower)) return 'es';
  if (/\b(bonjour|merci|s'il vous plait)\b/.test(lower)) return 'fr';
  return 'en';
}

/**
 * Build the degraded-mode `VoiceBrainPort`.
 *
 * TODO: wire to central-intelligence kernel for real voice responses.
 *
 * Until the kernel adapter ships, every turn returns a polite
 * "voice service not yet configured" reply in the detected language.
 * `modelVersion` is tagged `VOICE_BRAIN_NOT_CONFIGURED` so audit and
 * dashboards can flag these turns explicitly.
 */
function createDegradedVoiceBrainStub(
  logger?: VoiceAgentWiringDeps['logger'],
): VoiceBrainPort {
  return {
    async turn(input) {
      const lang = input.languageCode || detectLanguageFromTranscript(input.userTranscript);
      const reply = DEGRADED_REPLIES[lang] ?? DEGRADED_REPLIES.en;
      if (logger) {
        logger.warn(
          {
            tenantId: input.tenantId,
            sessionId: input.sessionId,
            languageCode: lang,
            promptHash: input.promptHash,
          },
          'voice-brain stub invoked (VOICE_BRAIN_NOT_CONFIGURED)',
        );
      }
      const response: VoiceBrainResponse = {
        text: reply,
        toolCalls: [],
        modelVersion: 'VOICE_BRAIN_NOT_CONFIGURED',
        inputTokens: 0,
        outputTokens: 0,
        costUsdMicro: 0,
      };
      return response;
    },
  };
}

/**
 * Adapt the DB-package `VoiceTurnsService` (duck-typed `VoiceTurnRowShape`)
 * to the agent's `VoiceTurnRepository` (`VoiceTurnRow`). Both shapes are
 * structurally compatible; this thin wrapper exists so a future schema
 * drift between the two cannot break the agent at runtime.
 */
function adaptToVoiceTurnRepository(
  service: VoiceTurnsService,
): VoiceTurnRepository {
  return {
    async insert(row: VoiceTurnRow) {
      const persisted = await service.insert(rowToShape(row));
      return shapeToRow(persisted);
    },
    async countBySession(tenantId, sessionId) {
      return service.countBySession(tenantId, sessionId);
    },
    async list(tenantId, sessionId) {
      const shapes = await service.list(tenantId, sessionId);
      return shapes.map(shapeToRow);
    },
  };
}

function rowToShape(row: VoiceTurnRow): VoiceTurnRowShape {
  return {
    id: row.id,
    tenantId: row.tenantId,
    sessionId: row.sessionId,
    turnIndex: row.turnIndex,
    customerId: row.customerId,
    detectedLanguage: row.detectedLanguage,
    inputTranscript: row.inputTranscript,
    responseText: row.responseText,
    responseAudioRef: row.responseAudioRef,
    toolCalls: row.toolCalls.map((tc) => ({
      name: tc.name,
      arguments: tc.arguments,
      result: tc.result,
      error: tc.error,
    })),
    degradedMode: row.degradedMode,
    modelVersion: row.modelVersion,
    promptHash: row.promptHash,
    latencyMs: row.latencyMs,
    createdAt: row.createdAt,
  };
}

function shapeToRow(shape: VoiceTurnRowShape): VoiceTurnRow {
  return {
    id: shape.id,
    tenantId: shape.tenantId,
    sessionId: shape.sessionId,
    turnIndex: shape.turnIndex,
    customerId: shape.customerId,
    detectedLanguage: shape.detectedLanguage,
    inputTranscript: shape.inputTranscript,
    responseText: shape.responseText,
    responseAudioRef: shape.responseAudioRef,
    toolCalls: shape.toolCalls.map((tc) => ({
      name: tc.name,
      arguments: tc.arguments,
      result: tc.result,
      error: tc.error,
    })),
    degradedMode: shape.degradedMode,
    modelVersion: shape.modelVersion,
    promptHash: shape.promptHash,
    latencyMs: shape.latencyMs,
    createdAt: shape.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Wire the voice-agent. Returns `null` when the database client is
 * unavailable — the caller (composition root) decides whether to skip
 * registration or fall through to a 503 on the voice routes.
 */
export function createVoiceAgentWiring(
  deps: VoiceAgentWiringDeps,
): VoiceAgentWiring | null {
  if (!deps.db) return null;

  const turnsService = createVoiceTurnsService(deps.db);
  const repo = adaptToVoiceTurnRepository(turnsService);
  const brain = createDegradedVoiceBrainStub(deps.logger);

  const agent = VoiceAgentNs.createVoiceAgent({
    brain,
    repo,
    stt: null,
    tts: null,
    // resolveCustomer intentionally omitted — agent tolerates undefined and
    // resolves customerId to null for the turn (best-effort contract).
  });

  return Object.freeze({ agent });
}
