/**
 * PI-A · integrations · no-op defaults — null-safe stub impls so consumers
 * can compose progressive-intelligence without immediately wiring the
 * surrounding substrate. Production replaces these with the real K-B / K-E
 * / K-D / M-B / M-E / J9 adapters.
 */

import type { ObservationEvent } from '../observations/types.js';

import type {
  IChatRenderSink,
  IConstitutionGate,
  IHighStakesVerifier,
  IReceiptEmitter,
  ITemporalKGSync,
  IVerbalizedConfidenceProvider,
} from './types.js';
import { isHighStakesAttr } from './types.js';

export const NoOpReceiptEmitter: IReceiptEmitter = Object.freeze({
  async emitAutoFillReceipt() {},
  async emitChangeRecord() {},
});

export const AllowAllConstitutionGate: IConstitutionGate = Object.freeze({
  async check() {
    return Object.freeze({ allowed: true });
  },
});

export const NoOpTemporalKGSync: ITemporalKGSync = Object.freeze({
  async syncHistoryEntry() {},
});

export const PassthroughHighStakesVerifier: IHighStakesVerifier = Object.freeze({
  isHighStakes(entityKind: string, attributeKey: string) {
    return isHighStakesAttr(entityKind, attributeKey);
  },
  async verify() {
    return Object.freeze({ verified: true });
  },
});

export const PassthroughVerbalizedConfidence: IVerbalizedConfidenceProvider = Object.freeze({
  async provide(observation: ObservationEvent) {
    return observation.source.confidence;
  },
});

export const NoOpChatRenderSink: IChatRenderSink = Object.freeze({
  async render() {},
});
