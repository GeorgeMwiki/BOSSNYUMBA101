/**
 * @bossnyumba/channel-gateway — public API.
 *
 * Unified inbound ChannelEvent canonicalizer + cross-channel state-sync + an
 * Africa's-Talking IVR -> STT adapter. Wire it at the api-gateway composition
 * root with {@link wireChannelGateway} by injecting a per-provider signature
 * verifier, a sender -> tier resolver, a conversation store, and an SSRF-safe
 * fetch port — then call `gateway.handle(...)` from each connector webhook
 * route. The gateway ships behind the default-OFF flag
 * {@link CHANNEL_GATEWAY_FLAG}.
 *
 * Ported and fully re-skinned to the BossNyumba real-estate domain. No direct
 * DB/SDK/env/network access — every side effect is an injected port.
 *
 * @module @bossnyumba/channel-gateway
 */

export * from './types';
export * from './ports';

export {
  createChannelGateway,
  type ChannelGateway,
  type ChannelGatewayDeps,
  type CanonicalizeInput,
} from './gateway';

export {
  canonicalizeByChannel,
  canonicalizeWhatsApp,
  canonicalizeSms,
  canonicalizeUssd,
  canonicalizeVoice,
  canonicalizeEmail,
  canonicalizeWeb,
  normalizePhone,
  type CanonicalDraft,
} from './canonicalizers';

export {
  createStateSync,
  type StateSync,
  type StateSyncDeps,
} from './state-sync';

export { createInMemoryConversationStore } from './in-memory-store';

export {
  stepIvr,
  transcribeRecording,
  type IvrState,
  type IvrLanguage,
  type IvrInput,
  type IvrStepResponse,
  type IvrSttPort,
  type TranscribeRecordingDeps,
  type TranscribeRecordingResult,
} from './africas-talking-ivr';

export {
  wireChannelGateway,
  CHANNEL_GATEWAY_FLAG,
  type ChannelGatewayFacade,
  type WireChannelGatewayDeps,
} from './wire';
