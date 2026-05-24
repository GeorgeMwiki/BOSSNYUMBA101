/**
 * HTTP route tests for the outcomes-metering service.
 *
 * Verifies:
 *   - POST /outcomes/events with a valid payload returns 201 and
 *     produces a billing line.
 *   - POST /outcomes/events with the same eventId twice is idempotent
 *     and returns 200 `idempotent: true` on the second attempt.
 *   - POST /outcomes/events refuses when X-Tenant-Id disagrees with
 *     the body tenantId (403).
 *   - GET /outcomes/billing/:tenantId/:month returns the per-month
 *     aggregate matching what the consumer wrote.
 *   - GET refuses when X-Tenant-Id disagrees with the path tenantId.
 */

import { describe, it, expect } from 'vitest';
import { buildApp } from '../index.js';

const TENANT = 't_demo';

describe('outcomes-metering HTTP routes', () => {
  it('POST /outcomes/events accepts a vacancy_filled event and records a billing line', async () => {
    const { app, store } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/outcomes/events',
      headers: { 'x-tenant-id': TENANT, 'content-type': 'application/json' },
      payload: {
        kind: 'vacancy_filled',
        eventId: 'evt_vac_1',
        tenantId: TENANT,
        propertyId: 'p_1',
        agentId: 'agent_a',
        occurredAt: '2026-05-10T10:00:00.000Z',
        confidence: 0.9,
        evidenceHash: 'sha256:abc',
        unitId: 'unit_42',
        leaseId: 'lease_42',
        leaseExecuted: true,
        moveInCompleted: true,
        monthlyRentMinor: 500_000,
        currency: 'USD',
        cancelledWithinWindow: false,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { qualified: boolean; recordId: string; billableAmountMinor: number };
    expect(body.qualified).toBe(true);
    expect(body.billableAmountMinor).toBe(250_000);

    // Read-side: the billing aggregate exposes the same numbers.
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM (now)
    void month;
    // The route stamps scoredAt with the current clock, so we read the
    // current month bucket. We can't assert on a fixed month string
    // without injecting the clock, so we read directly from the store.
    const aggregate = await store.getMonthlyBilling(TENANT, new Date().toISOString().slice(0, 7));
    expect(aggregate.byOutcome.vacancy_filled.totalBillableMinor).toBe(250_000);
  });

  it('POST /outcomes/events is idempotent on the second submission of the same eventId', async () => {
    const { app } = await buildApp();
    const payload = {
      kind: 'vacancy_filled' as const,
      eventId: 'evt_vac_dup',
      tenantId: TENANT,
      propertyId: 'p_1',
      agentId: 'agent_a',
      occurredAt: '2026-05-10T10:00:00.000Z',
      confidence: 0.9,
      evidenceHash: 'sha256:abc',
      unitId: 'unit_42',
      leaseId: 'lease_42',
      leaseExecuted: true,
      moveInCompleted: true,
      monthlyRentMinor: 500_000,
      currency: 'USD',
      cancelledWithinWindow: false,
    };
    const first = await app.inject({
      method: 'POST',
      url: '/outcomes/events',
      headers: { 'x-tenant-id': TENANT, 'content-type': 'application/json' },
      payload,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/outcomes/events',
      headers: { 'x-tenant-id': TENANT, 'content-type': 'application/json' },
      payload,
    });
    expect(second.statusCode).toBe(200);
    const body = second.json() as { idempotent: boolean };
    expect(body.idempotent).toBe(true);
  });

  it('POST /outcomes/events refuses on X-Tenant-Id / body tenantId mismatch', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/outcomes/events',
      headers: { 'x-tenant-id': 't_attacker', 'content-type': 'application/json' },
      payload: {
        kind: 'vacancy_filled',
        eventId: 'evt_xt',
        tenantId: 't_victim',
        propertyId: 'p_1',
        agentId: 'agent_a',
        occurredAt: '2026-05-10T10:00:00.000Z',
        confidence: 0.9,
        evidenceHash: 'sha256:abc',
        unitId: 'unit_42',
        leaseId: 'lease_42',
        leaseExecuted: true,
        moveInCompleted: true,
        monthlyRentMinor: 500_000,
        currency: 'USD',
        cancelledWithinWindow: false,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /outcomes/billing/:tenantId/:month returns the aggregate', async () => {
    const { app } = await buildApp();
    // Seed a billing line via POST.
    await app.inject({
      method: 'POST',
      url: '/outcomes/events',
      headers: { 'x-tenant-id': TENANT, 'content-type': 'application/json' },
      payload: {
        kind: 'vacancy_filled',
        eventId: 'evt_seed_b',
        tenantId: TENANT,
        propertyId: 'p_1',
        agentId: 'agent_a',
        occurredAt: '2026-05-10T10:00:00.000Z',
        confidence: 0.9,
        evidenceHash: 'sha256:abc',
        unitId: 'unit_42',
        leaseId: 'lease_42',
        leaseExecuted: true,
        moveInCompleted: true,
        monthlyRentMinor: 600_000,
        currency: 'USD',
        cancelledWithinWindow: false,
      },
    });
    const month = new Date().toISOString().slice(0, 7);
    const res = await app.inject({
      method: 'GET',
      url: `/outcomes/billing/${TENANT}/${month}`,
      headers: { 'x-tenant-id': TENANT },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { totalBillableMinor: number };
    expect(body.totalBillableMinor).toBe(300_000);
  });

  it('GET /outcomes/billing refuses on X-Tenant-Id / path tenantId mismatch', async () => {
    const { app } = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: `/outcomes/billing/t_victim/2026-05`,
      headers: { 'x-tenant-id': 't_attacker' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /healthz returns ok', async () => {
    const { app } = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'outcomes-metering' });
  });
});
