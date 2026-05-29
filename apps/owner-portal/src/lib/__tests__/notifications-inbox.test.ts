/**
 * notifications-inbox — kind-filter + item-building tests.
 */
import { describe, expect, it } from 'vitest';

import {
  buildNotificationItem,
  isNotificationKind,
} from '../notifications-inbox';

describe('notifications-inbox', () => {
  it('classifies notification-worthy kinds', () => {
    expect(isNotificationKind('rent.collected')).toBe(true);
    expect(isNotificationKind('lease.signed')).toBe(true);
    expect(isNotificationKind('reminder.fired')).toBe(true);
    expect(isNotificationKind('heartbeat')).toBe(false);
    expect(isNotificationKind('connected')).toBe(false);
    expect(isNotificationKind('decision.recorded')).toBe(false);
  });

  it('builds notification items with stable ids when present', () => {
    const item = buildNotificationItem('rent.collected', {
      eventId: 'evt-1',
      invoiceId: 'inv-1',
      amount: 500000,
    });
    expect(item?.id).toBe('evt-1');
    expect(item?.kind).toBe('rent.collected');
  });

  it('returns null for non-notification kinds', () => {
    expect(buildNotificationItem('heartbeat', {})).toBeNull();
    expect(buildNotificationItem('decision.recorded', {})).toBeNull();
  });

  it('generates fallback ids when payload lacks one', () => {
    const item = buildNotificationItem('rent.collected', {
      amount: 1,
    });
    expect(item?.id.startsWith('rent.collected-')).toBe(true);
  });
});
