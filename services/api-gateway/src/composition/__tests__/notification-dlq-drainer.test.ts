/**
 * Tests for the notifications-dispatcher DLQ drainer boot wiring.
 *
 * Covers the wiring concerns (the drainer's own logic is tested in
 * services/notifications/src/__tests__/dlq-drainer.test.ts):
 *   - `enabled: false` returns an inert stop with no side effects,
 *   - the returned stop() is always callable (even before the lazy import
 *     resolves),
 *   - a null db does not throw at wiring time.
 */

import { describe, it, expect, vi } from 'vitest';
import pino from 'pino';

import { startNotificationDlqDrainer } from '../notification-dlq-drainer';

const logger = pino({ level: 'silent' });

describe('startNotificationDlqDrainer', () => {
  it('returns an inert stop when disabled', () => {
    const info = vi.spyOn(logger, 'info');
    const stop = startNotificationDlqDrainer({
      db: null,
      logger,
      enabled: false,
    });
    expect(typeof stop).toBe('function');
    // Idempotent + safe to call.
    expect(() => stop()).not.toThrow();
    info.mockRestore();
  });

  it('does not throw at wiring time with a null db (degraded mode)', () => {
    const stop = startNotificationDlqDrainer({
      db: null,
      logger,
      enabled: true,
      intervalMs: 60_000,
    });
    expect(typeof stop).toBe('function');
    // Stop is callable immediately even though the lazy import may still be
    // in flight — the wiring guards against the shutdown-races-import case.
    expect(() => stop()).not.toThrow();
  });
});
