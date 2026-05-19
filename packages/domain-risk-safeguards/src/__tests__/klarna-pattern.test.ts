/**
 * Klarna-pattern wrap tests.
 *
 * 8 attempts — all 8 must be ROUTED, none EXECUTED. The wrap by design
 * cannot return `executed`; we test that no path skips the wrap.
 */

import { describe, it, expect } from 'vitest';
import {
  KLARNA_SLA_HOURS,
  KLARNA_SUPPORT_TIER,
  requiresKlarnaWrap,
  routeKlarnaAction,
} from '../klarna-pattern/index.js';
import type {
  KlarnaActionAttempt,
  KlarnaActionClass,
  KlarnaActor,
  KlarnaRouting,
  KlarnaRoutingPort,
} from '../types.js';

const TENANT = '33333333-3333-3333-3333-333333333333';

function attempt(
  actionClass: KlarnaActionClass,
  actor: KlarnaActor,
  idx: number,
): KlarnaActionAttempt {
  return Object.freeze({
    attemptId: `attempt-${idx}`,
    tenantId: TENANT,
    actor,
    actionClass,
    draft: 'Proposed action draft',
    evidence: ['ledger-snapshot.json', 'chat-transcript-2026-03-01.txt'],
    proposedAt: '2026-03-15T10:00:00.000Z',
  });
}

interface CapturedCall {
  attemptId: string;
  routing: KlarnaRouting;
  draft: string;
}

function recordingPort(): {
  port: KlarnaRoutingPort;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  return {
    port: {
      route: async (args) => {
        calls.push(args);
      },
    },
    calls,
  };
}

describe('Klarna-pattern — predicate `requiresKlarnaWrap`', () => {
  it('returns true for the 5 wrapped action classes', () => {
    expect(requiresKlarnaWrap('rent-dispute-resolution')).toBe(true);
    expect(requiresKlarnaWrap('late-fee-waiver')).toBe(true);
    expect(requiresKlarnaWrap('partial-refund')).toBe(true);
    expect(requiresKlarnaWrap('lease-amendment')).toBe(true);
    expect(requiresKlarnaWrap('eviction-decision')).toBe(true);
  });

  it('returns false for any other action', () => {
    expect(requiresKlarnaWrap('rent-reminder')).toBe(false);
    expect(requiresKlarnaWrap('lease-renewal-notice')).toBe(false);
    expect(requiresKlarnaWrap('eviction-notice-only')).toBe(false);
  });
});

describe('Klarna-pattern — 8 action attempts, all routed not executed', () => {
  const ownerActor: KlarnaActor = Object.freeze({
    kind: 'md-on-behalf-of-owner',
    ownerId: 'owner-1',
  });
  const counterpartyActor: KlarnaActor = Object.freeze({
    kind: 'md-on-behalf-of-tenant-owner-customer',
    ownerId: 'owner-2',
  });

  // 5 attempts — one per action class, owner-acting → route-to-tenant-owner
  for (const ac of [
    'rent-dispute-resolution',
    'late-fee-waiver',
    'partial-refund',
    'lease-amendment',
    'eviction-decision',
  ] as const satisfies readonly KlarnaActionClass[]) {
    it(`${ac} with md-on-behalf-of-owner → route-to-tenant-owner`, async () => {
      const { port, calls } = recordingPort();
      const v = await routeKlarnaAction({
        attempt: attempt(ac, ownerActor, calls.length),
        routing: port,
      });
      expect(v.verdict).toBe('routed-not-executed');
      expect(v.routing.kind).toBe('route-to-tenant-owner');
      expect(v.routing).toHaveProperty('ownerId', 'owner-1');
      expect((v.routing as { slaHours: number }).slaHours).toBe(KLARNA_SLA_HOURS[ac]);
      expect(calls.length).toBe(1);
      expect(v.draftPreserved).toBe('Proposed action draft');
      expect(v.auditCitations.length).toBeGreaterThan(0);
    });
  }

  // 2 attempts — owner-customer counterparty → route-to-bossnyumba-support
  it('rent-dispute with counterparty actor → route-to-bossnyumba-support tier-2', async () => {
    const { port, calls } = recordingPort();
    const v = await routeKlarnaAction({
      attempt: attempt('rent-dispute-resolution', counterpartyActor, 0),
      routing: port,
    });
    expect(v.routing.kind).toBe('route-to-bossnyumba-support');
    expect((v.routing as { tier: string }).tier).toBe(
      KLARNA_SUPPORT_TIER['rent-dispute-resolution'],
    );
    expect(calls.length).toBe(1);
  });

  it('eviction-decision with counterparty actor → route-to-bossnyumba-support tier-3', async () => {
    const { port, calls } = recordingPort();
    const v = await routeKlarnaAction({
      attempt: attempt('eviction-decision', counterpartyActor, 0),
      routing: port,
    });
    expect(v.routing.kind).toBe('route-to-bossnyumba-support');
    expect((v.routing as { tier: string }).tier).toBe('tier-3');
    expect(calls.length).toBe(1);
  });

  // 1 attempt — system actor → route-to-bossnyumba-support
  it('partial-refund with system actor → route-to-bossnyumba-support', async () => {
    const { port, calls } = recordingPort();
    const systemActor: KlarnaActor = Object.freeze({
      kind: 'md-on-behalf-of-system',
      systemId: 'sys-1',
    });
    const v = await routeKlarnaAction({
      attempt: attempt('partial-refund', systemActor, 0),
      routing: port,
    });
    expect(v.routing.kind).toBe('route-to-bossnyumba-support');
    expect(calls.length).toBe(1);
  });
});

describe('Klarna-pattern — SLA + support-tier maps are exhaustive', () => {
  it('every action class has a SLA hours mapping', () => {
    for (const ac of [
      'rent-dispute-resolution',
      'late-fee-waiver',
      'partial-refund',
      'lease-amendment',
      'eviction-decision',
    ] as const satisfies readonly KlarnaActionClass[]) {
      expect(KLARNA_SLA_HOURS[ac]).toBeGreaterThan(0);
      expect(KLARNA_SUPPORT_TIER[ac]).toMatch(/^tier-[1-3]$/);
    }
  });
});
