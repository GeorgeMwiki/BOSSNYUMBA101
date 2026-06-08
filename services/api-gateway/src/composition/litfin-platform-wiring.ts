/**
 * LITFIN-port platform composition helper (Batch 3).
 *
 * Wires 5 platform-domain packages onto `ServiceRegistry`:
 *
 *   - `@bossnyumba/security-hardening`: WebAuthn + TOTP + headers +
 *     rate-limit + anomaly + credential-stuffing detector + HIBP.
 *     Pre-wired via `createSecurityHardening({ headersEnv })` — the
 *     headers env is bound to NODE_ENV. WebAuthn + HIBP are NOT
 *     auto-constructed because they need an injected adapter
 *     (`@simplewebauthn/server` shim or `fetch` shim) that the caller
 *     is best placed to wire; the namespace export exposes them for
 *     follow-up wirings.
 *
 *   - `@bossnyumba/document-ai`: 5 OCR adapters + chat-with-doc +
 *     form extraction + multilingual + e-signature + accessibility.
 *     Pre-wired via `createDocumentAI({ ocr, brain })` with env-gated
 *     real ports: Anthropic Vision OCR when `OCR_PROVIDER` +
 *     `ANTHROPIC_API_KEY` are set, a real Claude brain when
 *     `ANTHROPIC_API_KEY` is set, and a deterministic empty-fixture mock
 *     OCR otherwise (never fixture ID data). E-sig stays the mock port.
 *     Per-tenant swap: pass concrete ports via
 *     `createLitfinPlatformBundle({ documentAi: { brain, ocr, embedder } })`.
 *
 *   - `@bossnyumba/progressive-intelligence`: entity resolution +
 *     active learning + live coaching + streaming + profile
 *     unification + personalization. Pre-wired via
 *     `createProgressiveIntelligence()` with deterministic mock
 *     embedder (no brain — coaching / streaming endpoints stay
 *     dormant until a brain port is bound).
 *
 *   - `@bossnyumba/document-quality-guarantor`: multi-engine
 *     fallback + 7 quality gates + retry queue + escalation +
 *     audit-chain. The full facade requires intake / output
 *     orchestrators that need per-tenant brain ports; we expose
 *     the namespace + a pre-wired in-memory audit chain so
 *     consumers can call `replayOperation` without re-instantiation.
 *     Per-tenant guarantor instantiation happens at request time.
 *
 *   - `@bossnyumba/audio-capture`: STT + TTS + VAD + diarization +
 *     enhancement + voice-clone + realtime. Pre-wired via
 *     `createAudioCapture()` with no ports — every adapter slot is
 *     null until provider creds land; consumers gate on
 *     `audioCapture.stt !== null` before calling `startRealtimeSession`.
 */

import * as SecurityHardeningNs from '@bossnyumba/security-hardening';
import * as DocumentAINs from '@bossnyumba/document-ai';
import * as ProgressiveIntelligenceNs from '@bossnyumba/progressive-intelligence';
import * as DocumentQualityGuarantorNs from '@bossnyumba/document-quality-guarantor';
import * as AudioCaptureNs from '@bossnyumba/audio-capture';
import {
  createSecurityHardening,
  type SecurityHardening,
  type SecurityHeaderEnv,
} from '@bossnyumba/security-hardening';
import {
  createDocumentAI,
  createAnthropicVisionAdapter,
  createMockOCRAdapter,
  type DocumentAI,
  type BrainPort,
  type EmbedderPort,
  type OCRPort,
} from '@bossnyumba/document-ai';
import { getModelLatest } from '@bossnyumba/brain-llm-router/dynamic-registry';
import {
  createProgressiveIntelligence,
  createDeterministicMockEmbedder,
  type ProgressiveIntelligence,
} from '@bossnyumba/progressive-intelligence';
import {
  createInMemoryAuditChainStore,
  type AuditChainStore,
} from '@bossnyumba/document-quality-guarantor';
import { createAudioCapture, type AudioCapture } from '@bossnyumba/audio-capture';
import { logger } from '../utils/logger.js';

export interface LitfinPlatformBundle {
  /** WebAuthn + TOTP + headers + rate-limit + anomaly namespace. */
  readonly securityHardening: typeof SecurityHardeningNs;
  /** Document AI namespace (OCR + chat-with-doc + form extraction + e-sig). */
  readonly documentAI: typeof DocumentAINs;
  /** Progressive Intelligence namespace (entity res + active learning + coach). */
  readonly progressiveIntelligence: typeof ProgressiveIntelligenceNs;
  /** Document Quality Guarantor namespace (gates + retry + escalation + audit). */
  readonly documentQualityGuarantor: typeof DocumentQualityGuarantorNs;
  /** Audio capture namespace (STT/TTS/VAD/diarization/voice-clone/realtime). */
  readonly audioCapture: typeof AudioCaptureNs;

  /**
   * Pre-wired security hardening facade. `headersEnv` is bound to
   * NODE_ENV so middleware is environment-aware out of the box.
   * Default rate limiter omitted (per-route limits land in the
   * Hono middleware composition root). WebAuthn + HIBP are NOT
   * auto-constructed — bind them via the namespace export when the
   * `@simplewebauthn/server` shim + `fetch` shim are wired.
   */
  readonly securityHardeningInstance: SecurityHardening;

  /** Pre-wired Document AI facade with env-gated real OCR + brain ports
   *  (Anthropic when keyed, empty-fixture mock OCR otherwise) + mock
   *  e-sig. Swap per-tenant ports at composition time via the
   *  `LitfinPlatformBundleConfig.documentAi` overrides. */
  readonly documentAIInstance: DocumentAI;

  /** Pre-wired Progressive Intelligence facade with deterministic
   *  mock embedder (no brain — gates that need a brain return
   *  dormant results until a brain port is bound). */
  readonly progressiveIntelligenceInstance: ProgressiveIntelligence;

  /** Pre-wired in-memory audit chain store for DQG.replayAudit
   *  callers. Per-tenant guarantor facades are instantiated at
   *  request time because intake/output orchestrators bind to
   *  per-tenant brain + format-registry ports. */
  readonly dqgAuditStore: AuditChainStore;

  /** Pre-wired Audio Capture facade with no ports — every adapter
   *  slot is null until provider creds (Deepgram / ElevenLabs /
   *  OpenAI Whisper) land. Consumers gate on
   *  `audioCaptureInstance.stt !== null` before calling
   *  `startRealtimeSession`. */
  readonly audioCaptureInstance: AudioCapture;
}

/**
 * Pick the security headers env from NODE_ENV. Defaults to
 * `development` so local dev doesn't accidentally inherit prod CSP.
 */
function resolveSecurityHeadersEnv(): SecurityHeaderEnv {
  const env = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (env === 'production' || env === 'prod') return 'production';
  if (env === 'staging' || env === 'stage') return 'staging';
  return 'development';
}

/**
 * Resolve the Document-AI OCR port from env at composition time.
 *
 * Module-G fix: `createDocumentAI()` previously defaulted to an empty-
 * fixture mock OCR, so every document-intelligence call silently
 * produced blank text. We now gate the OCR provider on `OCR_PROVIDER`:
 *
 *   - `OCR_PROVIDER=anthropic_vision` (or `anthropic` / `claude`) with
 *     `ANTHROPIC_API_KEY` present wires the real Claude Vision adapter
 *     (strong on Swahili / French scans + handwriting). The model id is
 *     resolved via the dynamic registry — never a pinned literal.
 *   - Anything else (or a missing key) returns the deterministic mock —
 *     never fixture ID data, just an empty parse — with a single warn so
 *     the gap is observable instead of silent.
 *
 * Reads `process.env` here because this IS the bundle's composition
 * root (same posture as `resolveSecurityHeadersEnv` above and the sibling
 * brain wirings); no `process.env` access leaks into request paths.
 */
function resolveDocumentAiOcrPort(): OCRPort {
  const provider = (process.env.OCR_PROVIDER ?? '').trim().toLowerCase();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const wantsVision =
    provider === 'anthropic_vision' ||
    provider === 'anthropic' ||
    provider === 'claude' ||
    provider === 'vision';

  if (wantsVision && apiKey) {
    return createAnthropicVisionAdapter({
      apiKey,
      model: getModelLatest('opus'),
    });
  }

  if (wantsVision && !apiKey) {
    logger.warn(
      'OCR_PROVIDER requested Anthropic Vision but ANTHROPIC_API_KEY is unset — ' +
        'falling back to empty-fixture mock OCR (no real text extraction).'
    );
  }
  return createMockOCRAdapter({ fixture: { pages: [] } });
}

/**
 * Resolve a Document-AI `BrainPort` from env at composition time. When
 * `ANTHROPIC_API_KEY` is present we wire a thin Claude completion adapter
 * (same fetch posture as `executive-brief.composition.ts`); otherwise we
 * return `undefined` so form-extraction + chat-with-doc degrade cleanly
 * rather than calling a fake brain. The real per-tenant budget-guarded
 * brain can be injected via `createLitfinPlatformBundle({ brain })`.
 */
function resolveDocumentAiBrainPort(): BrainPort | undefined {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return undefined;
  return {
    async complete(prompt, options) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: getModelLatest('opus'),
          max_tokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!resp.ok) {
        throw new Error(`document-ai brain HTTP ${resp.status}`);
      }
      const json = (await resp.json()) as {
        readonly content?: ReadonlyArray<{ readonly text?: string }>;
        readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number };
      };
      const text = (json.content ?? [])
        .map((part) => part.text ?? '')
        .join('');
      const tokensUsed =
        (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0);
      return { text, tokensUsed };
    },
  };
}

/**
 * Optional injectable overrides for the Document-AI facade. Lets a
 * per-tenant / budget-guarded brain, a concrete embedder, an e-signature
 * provider, or an OCR port be threaded in from a richer composition root.
 * Every field is optional — when omitted the bundle env-gates a sensible
 * default (real Anthropic OCR/brain when keyed, mock otherwise) so the
 * gateway still boots without external creds.
 */
export interface LitfinPlatformBundleConfig {
  readonly documentAi?: {
    readonly ocr?: OCRPort;
    readonly brain?: BrainPort;
    readonly embedder?: EmbedderPort;
  };
}

/**
 * Build the LITFIN platform bundle. Always non-null in both degraded
 * and live modes; all 5 facades have safe in-memory / mock-port
 * defaults so the gateway boots without external creds.
 *
 * Module-G fix: the Document-AI facade is no longer `createDocumentAI()`
 * with zero args (which silently defaulted to empty-fixture mock OCR and
 * no brain). It now receives env-gated real adapters — a real OCR port
 * (Anthropic Vision when `OCR_PROVIDER` + `ANTHROPIC_API_KEY` are set)
 * and a real brain port (when `ANTHROPIC_API_KEY` is set) — with explicit
 * injectable overrides via `config.documentAi` for per-tenant wiring.
 */
export function createLitfinPlatformBundle(
  config: LitfinPlatformBundleConfig = {}
): LitfinPlatformBundle {
  return Object.freeze({
    securityHardening: SecurityHardeningNs,
    documentAI: DocumentAINs,
    progressiveIntelligence: ProgressiveIntelligenceNs,
    documentQualityGuarantor: DocumentQualityGuarantorNs,
    audioCapture: AudioCaptureNs,
    securityHardeningInstance: createSecurityHardening({
      headersEnv: resolveSecurityHeadersEnv(),
    }),
    documentAIInstance: createDocumentAI({
      ocr: config.documentAi?.ocr ?? resolveDocumentAiOcrPort(),
      brain: config.documentAi?.brain ?? resolveDocumentAiBrainPort(),
      embedder: config.documentAi?.embedder,
    }),
    progressiveIntelligenceInstance: createProgressiveIntelligence({
      embedder: createDeterministicMockEmbedder(),
    }),
    dqgAuditStore: createInMemoryAuditChainStore(),
    audioCaptureInstance: createAudioCapture(),
  });
}
