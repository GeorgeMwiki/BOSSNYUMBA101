/**
 * Cockpit-events bus — smoke + tenant isolation tests.
 *
 * These tests mirror the Borjie tenant-isolation invariants: publishes
 * from tenant A MUST NOT leak into tenant B's subscriber set.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  publishCockpitEvent,
  subscribeCockpitEvents,
  __resetCockpitBusForTests,
} from '../bus.js';
import type { CockpitEvent } from '../types.js';

describe('cockpit-events/bus', () => {
  beforeEach(() => {
    __resetCockpitBusForTests();
  });

  afterEach(() => {
    __resetCockpitBusForTests();
  });

  it('delivers an event to a subscriber on the same tenant', () => {
    const received: CockpitEvent[] = [];
    const unsubscribe = subscribeCockpitEvents('tenant-a', (e) => {
      received.push(e);
    });

    const delivered = publishCockpitEvent({
      kind: 'decision.recorded',
      tenantId: 'tenant-a',
      emittedAt: '2026-05-29T10:00:00Z',
      decisionId: 'd-1',
      subject: 'Approve renewal',
      severity: 'medium',
    });

    expect(delivered).toBe(1);
    expect(received).toHaveLength(1);
    expect(received[0]?.kind).toBe('decision.recorded');

    unsubscribe();
  });

  it('does not leak events across tenants', () => {
    const receivedA: CockpitEvent[] = [];
    const receivedB: CockpitEvent[] = [];

    const offA = subscribeCockpitEvents('tenant-a', (e) => receivedA.push(e));
    const offB = subscribeCockpitEvents('tenant-b', (e) => receivedB.push(e));

    publishCockpitEvent({
      kind: 'rent.collected',
      tenantId: 'tenant-a',
      emittedAt: '2026-05-29T10:00:00Z',
      invoiceId: 'inv-1',
      leaseId: 'lease-1',
      unitId: 'unit-1',
      amount: 500_000,
      currencyCode: 'TZS',
      method: 'mpesa',
    });

    expect(receivedA).toHaveLength(1);
    expect(receivedB).toHaveLength(0);

    offA();
    offB();
  });

  it('returns 0 when no subscribers exist for the tenant', () => {
    const delivered = publishCockpitEvent({
      kind: 'reminder.fired',
      tenantId: 'tenant-c',
      emittedAt: '2026-05-29T10:00:00Z',
      reminderId: 'r-1',
      title: 'Rent due tomorrow',
      channel: 'sms',
    });

    expect(delivered).toBe(0);
  });

  it('respects unsubscribe — handler stops firing', () => {
    const received: CockpitEvent[] = [];
    const unsubscribe = subscribeCockpitEvents('tenant-a', (e) => {
      received.push(e);
    });

    unsubscribe();

    const delivered = publishCockpitEvent({
      kind: 'reminder.fired',
      tenantId: 'tenant-a',
      emittedAt: '2026-05-29T10:00:00Z',
      reminderId: 'r-1',
      title: 'Rent due tomorrow',
      channel: 'sms',
    });

    expect(delivered).toBe(0);
    expect(received).toHaveLength(0);
  });
});
