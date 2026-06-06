/**
 * KI-007 — ConditionalSurveyService narrative wiring.
 *
 * Proves:
 *  (a) with NO mediator/key the deterministic fallback narrative is
 *      produced (and does not throw);
 *  (b) with an injected gateway stub its narrative is used.
 */

import { describe, it, expect, vi } from 'vitest';
import { asTenantId, asUserId, asPropertyId } from '@bossnyumba/domain-models';
import type { EventBus } from '../../common/events.js';
import {
  ConditionalSurveyService,
  asConditionalSurveyId,
  type ConditionalSurvey,
  type ConditionalSurveyFinding,
  type ConditionalSurveyActionPlan,
  type ConditionalSurveyRepository,
} from './index.js';
import type { SurveyNarrativeGateway } from '../narrative-port.js';

const tenant = asTenantId('tnt_a');
const propertyId = asPropertyId('prop_1');
const user = asUserId('usr_1');

function createInMemoryRepo(): ConditionalSurveyRepository {
  const store = new Map<string, ConditionalSurvey>();
  const findings = new Map<string, ConditionalSurveyFinding[]>();
  const plans = new Map<string, ConditionalSurveyActionPlan[]>();
  return {
    async findById(id, tenantId) {
      const s = store.get(id);
      if (!s || s.tenantId !== tenantId) return null;
      return {
        ...s,
        findings: findings.get(id) ?? [],
        actionPlans: plans.get(id) ?? [],
      };
    },
    async create(survey) {
      store.set(survey.id, survey);
      findings.set(survey.id, findings.get(survey.id) ?? []);
      plans.set(survey.id, plans.get(survey.id) ?? []);
      return survey;
    },
    async update(survey) {
      store.set(survey.id, survey);
      return survey;
    },
    async addFinding(f) {
      const list = findings.get(f.surveyId) ?? [];
      findings.set(f.surveyId, [...list, f]);
      return f;
    },
    async addActionPlan(p) {
      const list = plans.get(p.surveyId) ?? [];
      plans.set(p.surveyId, [...list, p]);
      return p;
    },
    async updateActionPlan(p) {
      return p;
    },
  };
}

function createEventBus(): EventBus {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  } as unknown as EventBus;
}

async function seedSurveyWithFinding(
  service: ConditionalSurveyService
): Promise<ReturnType<typeof asConditionalSurveyId>> {
  const scheduled = await service.scheduleSurvey({
    tenantId: tenant,
    propertyId,
    scheduledAt: '2026-06-01T00:00:00Z' as never,
    createdBy: user,
  });
  if (!scheduled.success) throw new Error('schedule failed');
  const surveyId = scheduled.data.id;
  const attached = await service.attachFinding({
    surveyId,
    tenantId: tenant,
    area: 'Roof',
    title: 'Cracked tiles',
    description: 'Water ingress risk',
    severity: 'critical',
    createdBy: user,
  });
  if (!attached.success) throw new Error('attach failed');
  return surveyId;
}

describe('ConditionalSurveyService narrative (KI-007)', () => {
  it('(a) produces a deterministic narrative with no gateway/key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const service = new ConditionalSurveyService(
      createInMemoryRepo(),
      createEventBus()
    );
    const surveyId = await seedSurveyWithFinding(service);

    const compiled = await service.compileReport(surveyId, tenant, user);
    expect(compiled.success).toBe(true);
    if (!compiled.success) return;
    // Narrative is present, non-empty, and mentions the finding count.
    expect(compiled.data.narrative).toBeTruthy();
    expect(compiled.data.narrative).toContain('1 finding');
    expect(compiled.data.status).toBe('compiled');
  });

  it('(b) uses an injected gateway narrative when provided', async () => {
    const gateway: SurveyNarrativeGateway = {
      compose: vi.fn(async (input) => ({
        headline: 'STUB HEADLINE',
        narrative: `STUB NARRATIVE for ${input.findings.length} findings`,
        riskFlags: ['stub-flag'],
      })),
    };
    const service = new ConditionalSurveyService(
      createInMemoryRepo(),
      createEventBus(),
      gateway
    );
    const surveyId = await seedSurveyWithFinding(service);

    const compiled = await service.compileReport(surveyId, tenant, user);
    expect(compiled.success).toBe(true);
    if (!compiled.success) return;
    expect(gateway.compose).toHaveBeenCalledOnce();
    expect(compiled.data.narrative).toBe('STUB NARRATIVE for 1 findings');
  });
});
