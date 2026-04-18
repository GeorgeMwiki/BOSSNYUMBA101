/**
 * Notification webhook signature verification (SCAFFOLDED 8 + NEW 21)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac } from 'node:crypto';
import { __internal } from '../routes/notification-webhooks.router.js';

describe('notification-webhooks signature verification', () => {
  const body = '{"ok":true}';

  describe('africastalking', () => {
    const secret = 'at-secret';
    beforeAll(() => {
      process.env.AFRICASTALKING_WEBHOOK_SECRET = secret;
    });
    afterAll(() => {
      delete process.env.AFRICASTALKING_WEBHOOK_SECRET;
    });

    it('accepts a valid HMAC-SHA256 hex signature', () => {
      const sig = createHmac('sha256', secret).update(body).digest('hex');
      expect(__internal.verifyAfricasTalking(body, sig)).toBe(true);
    });

    it('rejects a forged signature', () => {
      const sig = createHmac('sha256', 'wrong').update(body).digest('hex');
      expect(__internal.verifyAfricasTalking(body, sig)).toBe(false);
    });

    it('rejects missing signature', () => {
      expect(__internal.verifyAfricasTalking(body, undefined)).toBe(false);
    });
  });

  describe('meta', () => {
    const secret = 'meta-secret';
    beforeAll(() => {
      process.env.META_APP_SECRET = secret;
    });
    afterAll(() => {
      delete process.env.META_APP_SECRET;
    });

    it('accepts the sha256=<hex> form', () => {
      const hex = createHmac('sha256', secret).update(body).digest('hex');
      expect(__internal.verifyMeta(body, `sha256=${hex}`)).toBe(true);
    });

    it('rejects missing prefix', () => {
      const hex = createHmac('sha256', secret).update(body).digest('hex');
      expect(__internal.verifyMeta(body, hex)).toBe(false);
    });
  });

  describe('normalization', () => {
    it('normalizes africastalking status strings', () => {
      expect(__internal.normalizeAfricasTalkingStatus({ status: 'Success' })).toBe('delivered');
      expect(__internal.normalizeAfricasTalkingStatus({ status: 'Failed' })).toBe('failed');
      expect(__internal.normalizeAfricasTalkingStatus({ status: 'Queued' })).toBe('unknown');
    });

    it('normalizes twilio status strings', () => {
      expect(__internal.normalizeTwilioStatus({ MessageStatus: 'delivered' })).toBe('delivered');
      expect(__internal.normalizeTwilioStatus({ MessageStatus: 'undelivered' })).toBe('failed');
      expect(__internal.normalizeTwilioStatus({ SmsStatus: 'queued' })).toBe('sent');
    });
  });
});
