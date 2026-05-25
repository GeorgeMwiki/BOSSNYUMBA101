import { describe, expect, it } from 'vitest';
import {
  bestChannel,
  reachabilityScores,
} from '../communication/reachability-scorer.js';
import { routeChannels } from '../communication/multi-channel-router.js';

const tenant = {
  tenantId: 't1',
  whatsappReadRate: 0.9,
  smsDeliveryRate: 0.7,
  emailOpenRate: 0.4,
  voiceAnswerRate: 0.2,
};

describe('reachability-scorer', () => {
  it('sorts WhatsApp first for digital-native tenant', () => {
    expect(bestChannel(tenant)).toBe('whatsapp');
  });

  it('handles all-zero gracefully', () => {
    const r = reachabilityScores({
      tenantId: 't2',
      whatsappReadRate: 0,
      smsDeliveryRate: 0,
      emailOpenRate: 0,
      voiceAnswerRate: 0,
    });
    expect(r[0].score).toBe(0);
  });

  it('rejects NaN as zero', () => {
    const r = reachabilityScores({
      tenantId: 't3',
      whatsappReadRate: Number.NaN,
      smsDeliveryRate: 0.5,
      emailOpenRate: 0.6,
      voiceAnswerRate: 0,
    });
    expect(r[0].channel).toBe('email');
  });
});

describe('multi-channel-router', () => {
  it('picks WhatsApp + lists fallbacks in score order', () => {
    const r = routeChannels(tenant);
    expect(r.preferred).toBe('whatsapp');
    // voice (0.2) is exactly at the floor so it survives the filter.
    expect(r.fallbacks).toEqual(['sms', 'email', 'voice']);
  });

  it('falls back to all channels if everyone is below floor', () => {
    const r = routeChannels({
      tenantId: 't4',
      whatsappReadRate: 0.01,
      smsDeliveryRate: 0.01,
      emailOpenRate: 0.01,
      voiceAnswerRate: 0,
    });
    expect(r.scores.length).toBe(4);
    expect(r.preferred).toBeTruthy();
  });

  it('respects custom minScore', () => {
    const r = routeChannels(tenant, { minScore: 0.5 });
    expect(r.fallbacks).toEqual(['sms']);
  });
});
