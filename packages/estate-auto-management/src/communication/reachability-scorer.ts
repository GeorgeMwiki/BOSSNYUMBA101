/**
 * Reachability scorer — per-tenant, per-channel score on the
 * basis of historical delivery / read / answer rates.
 */

import type { ChannelScore, CommsChannel, TenantReachability } from '../types.js';

export function reachabilityScores(t: TenantReachability): ChannelScore[] {
  const arr: ChannelScore[] = [
    { channel: 'whatsapp', score: clamp01(t.whatsappReadRate) },
    { channel: 'sms', score: clamp01(t.smsDeliveryRate) },
    { channel: 'email', score: clamp01(t.emailOpenRate) },
    { channel: 'voice', score: clamp01(t.voiceAnswerRate) },
  ];
  return arr.sort((a, b) => b.score - a.score);
}

export function bestChannel(t: TenantReachability): CommsChannel {
  return reachabilityScores(t)[0].channel;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
