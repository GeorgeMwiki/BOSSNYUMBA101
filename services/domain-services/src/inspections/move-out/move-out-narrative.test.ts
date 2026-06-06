/**
 * KI-007 — MoveOutChecklistService damage-claim narrative wiring.
 *
 * Proves:
 *  (a) with NO gateway/key the handoff carries a deterministic narrative
 *      (no throw);
 *  (b) with an injected gateway stub its narrative is used and reaches the
 *      damage sink.
 */

import { describe, it, expect, vi } from 'vitest';
import { asTenantId, asUserId } from '@bossnyumba/domain-models';
import type { EventBus } from '../../common/events.js';
import type { Inspection } from '../types.js';
import type { InspectionRepository } from '../inspection-service.js';
import {
  MoveOutChecklistService,
  type DamageClaimHandoff,
  type DamageDeductionCaseSink,
} from './index.js';
import type { SurveyNarrativeGateway } from '../narrative-port.js';

const tenant = asTenantId('tnt_a');
const propertyId = 'prop_1' as never;
const unitId = 'unit_1' as never;
const user = asUserId('usr_1');

function createInspectionRepo(): InspectionRepository {
  const store = new Map<string, Inspection>();
  return {
    async findById(id, tenantId) {
      const i = store.get(id);
      if (!i || i.tenantId !== tenantId) return null;
      return i;
    },
    async findMany(tenantId) {
      const items = Array.from(store.values()).filter(
        (i) => i.tenantId === tenantId
      );
      return {
        items,
        total: items.length,
        page: 1,
        limit: items.length,
        totalPages: 1,
      } as never;
    },
    async create(i) {
      store.set(i.id, i);
      return i;
    },
    async update(i) {
      store.set(i.id, i);
      return i;
    },
  };
}

function createEventBus(): EventBus {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  } as unknown as EventBus;
}

async function seedMoveOutWithDamage(
  svc: MoveOutChecklistService
): Promise<string> {
  const start = await svc.startInspection({
    tenantId: tenant,
    propertyId,
    unitId,
    inspectorId: user,
    scheduledDate: new Date().toISOString() as never,
  });
  if (!start.success) throw new Error('start failed');
  const id = start.data.id;
  const cap = await svc.captureFindings({
    tenantId: tenant,
    inspectionId: id,
    roomId: 'kitchen',
    itemName: 'Countertop',
    condition: 'damaged',
    notes: 'Deep burn marks',
    photos: ['p1'],
    addedBy: user,
  });
  if (!cap.success) throw new Error('capture failed');
  return id;
}

describe('MoveOutChecklistService narrative (KI-007)', () => {
  it('(a) deterministic narrative on the handoff with no gateway/key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const repo = createInspectionRepo();
    const svc = new MoveOutChecklistService(repo, createEventBus());
    const id = await seedMoveOutWithDamage(svc);

    const res = await svc.fileDamageClaim({
      tenantId: tenant,
      moveOutInspectionId: id as never,
      filedBy: user,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.narrative).toBeTruthy();
    // Deterministic narrative reflects the single damage finding.
    expect(res.data.narrative).toContain('1 finding');
    expect(res.data.narrative).toContain('Countertop');
  });

  it('(b) injected gateway narrative is used and forwarded to the sink', async () => {
    const repo = createInspectionRepo();
    const gateway: SurveyNarrativeGateway = {
      compose: vi.fn(async () => ({
        headline: 'H',
        narrative: 'AI DAMAGE NARRATIVE',
        riskFlags: [],
      })),
    };
    let captured: DamageClaimHandoff | null = null;
    const sink: DamageDeductionCaseSink = {
      handoff: vi.fn(async (h) => {
        captured = h;
        return { caseId: 'case_1' };
      }),
    };
    const svc = new MoveOutChecklistService(
      repo,
      createEventBus(),
      sink,
      gateway
    );
    const id = await seedMoveOutWithDamage(svc);

    const res = await svc.fileDamageClaim({
      tenantId: tenant,
      moveOutInspectionId: id as never,
      filedBy: user,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(gateway.compose).toHaveBeenCalledOnce();
    expect(res.data.narrative).toBe('AI DAMAGE NARRATIVE');
    expect(sink.handoff).toHaveBeenCalledOnce();
    expect(captured).not.toBeNull();
    expect((captured as unknown as DamageClaimHandoff).narrative).toBe(
      'AI DAMAGE NARRATIVE'
    );
  });
});
