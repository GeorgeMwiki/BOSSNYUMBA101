/**
 * KI-007 — FarScheduler narrative-style dispatch wiring.
 *
 * Proves:
 *  (a) with NO gateway/key the dispatch subject/body are a deterministic
 *      narrative (no throw);
 *  (b) with an injected gateway stub its headline/narrative drive the
 *      dispatch subject/body.
 */

import { describe, it, expect, vi } from 'vitest';
import { asTenantId, asUserId } from '@bossnyumba/domain-models';
import { FarScheduler, type NotificationDispatcher } from './far-scheduler.js';
import {
  asFarAssignmentId,
  asAssetComponentId,
  type FarAssignment,
  type FarRepository,
  type NotifyRecipient,
} from './types.js';
import type { SurveyNarrativeGateway } from '../narrative-port.js';

const tenant = asTenantId('tnt_a');
const user = asUserId('usr_1');

function makeAssignment(): FarAssignment {
  const recipients: readonly NotifyRecipient[] = [
    { role: 'landlord', userId: user, email: 'l@x.com', phone: null },
  ];
  return {
    id: asFarAssignmentId('far_1'),
    tenantId: tenant,
    componentId: asAssetComponentId('comp_1'),
    assignedTo: user,
    frequency: 'monthly',
    status: 'active',
    triggerRules: {},
    firstCheckDueAt: '2026-05-01T00:00:00Z' as never,
    nextCheckDueAt: '2026-05-08T00:00:00Z' as never,
    lastCheckedAt: null,
    notifyRecipients: recipients,
    createdAt: '2026-04-01T00:00:00Z' as never,
    updatedAt: '2026-04-01T00:00:00Z' as never,
    createdBy: user,
    updatedBy: user,
  };
}

function makeRepo(due: readonly FarAssignment[]): FarRepository {
  return {
    findComponentById: vi.fn(),
    findAssignmentById: vi.fn(),
    createComponent: vi.fn(),
    createAssignment: vi.fn(),
    updateAssignment: vi.fn(),
    createCheckEvent: vi.fn(),
    findDueAssignments: vi.fn(async () => due),
    findScheduledChecks: vi.fn(async () => []),
  } as unknown as FarRepository;
}

function makeDispatcher() {
  return {
    dispatch: vi.fn(async () => undefined),
  } satisfies NotificationDispatcher;
}

describe('FarScheduler narrative (KI-007)', () => {
  it('(a) deterministic narrative subject/body with no gateway/key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const dispatcher = makeDispatcher();
    const scheduler = new FarScheduler(makeRepo([makeAssignment()]), dispatcher);

    const result = await scheduler.run();
    expect(result).toHaveLength(1);
    expect(dispatcher.dispatch).toHaveBeenCalledOnce();
    const call = dispatcher.dispatch.mock.calls[0]?.[0];
    expect(call?.subject).toBeTruthy();
    expect(call?.body).toBeTruthy();
    // Deterministic body references the due component and the due date hint.
    expect(call?.body).toContain('comp_1');
    expect(call?.body).toContain('2026-05-08');
  });

  it('(b) injected gateway headline/narrative drive subject/body', async () => {
    const gateway: SurveyNarrativeGateway = {
      compose: vi.fn(async () => ({
        headline: 'AI SUBJECT',
        narrative: 'AI BODY PROSE.',
        riskFlags: [],
      })),
    };
    const dispatcher = makeDispatcher();
    const scheduler = new FarScheduler(
      makeRepo([makeAssignment()]),
      dispatcher,
      gateway
    );

    await scheduler.run();
    expect(gateway.compose).toHaveBeenCalledOnce();
    const call = dispatcher.dispatch.mock.calls[0]?.[0];
    expect(call?.subject).toBe('AI SUBJECT');
    expect(call?.body).toContain('AI BODY PROSE.');
  });
});
