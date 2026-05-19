import { describe, expect, it } from 'vitest';
import { makeCtx } from './_helpers.js';
import type { DispatchTransportPort } from '../primitives/dispatch.js';
import {
  createMaintenanceDispatch,
  defaultClassifier,
  vendorToDispatchCandidate,
} from '../verticals/property-management/maintenance-dispatch.js';
import type {
  MaintenanceTicket,
  VendorCandidate,
} from '../verticals/property-management/entities.js';

function vendor(
  id: string,
  name: string,
  specialty: VendorCandidate['specialty'],
  afterHours = false,
): VendorCandidate {
  return {
    id,
    displayName: name,
    specialty,
    avgResponseMinutes: 30,
    slaBreachRate: 0.05,
    costRating: 3,
    afterHoursAvailable: afterHours,
  };
}

function ticket(text: string, photoCount = 0): MaintenanceTicket {
  return {
    id: 'tk-1',
    tenantId: 'tenant-1',
    propertyId: 'prop-1',
    unitRef: 'A12',
    raisedAtMs: 1_700_000_000_000,
    reporterName: 'Alice',
    issueText: text,
    photoCount,
  };
}

const inMemoryTransport: DispatchTransportPort<string> = {
  async send({ candidate }) {
    return { externalMessageId: `mock-${candidate.id}` };
  },
};

describe('defaultClassifier', () => {
  it('flags emergency keywords as emergency', async () => {
    const result = await defaultClassifier.classify({
      input: ticket('burst pipe in kitchen'),
      ctx: makeCtx().ctx,
      recordLlmCall: () => true,
    });
    expect(result.label).toBe('emergency');
    expect(result.category).toBe('plumbing');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('flags urgent keywords as urgent', async () => {
    const result = await defaultClassifier.classify({
      input: ticket('leak under sink'),
      ctx: makeCtx().ctx,
      recordLlmCall: () => true,
    });
    expect(result.label).toBe('urgent');
  });

  it('classifies electrical issues', async () => {
    const result = await defaultClassifier.classify({
      input: ticket('socket sparking, no power'),
      ctx: makeCtx().ctx,
      recordLlmCall: () => true,
    });
    expect(result.category).toBe('electrical');
    expect(result.label).toBe('emergency'); // 'no power' is in emergencyKeywords
  });

  it('falls back to cosmetic when no severity keywords and no photos', async () => {
    const result = await defaultClassifier.classify({
      input: ticket('paint chipped'),
      ctx: makeCtx().ctx,
      recordLlmCall: () => true,
    });
    expect(result.label).toBe('cosmetic');
  });

  it('treats photo evidence as standard', async () => {
    const result = await defaultClassifier.classify({
      input: ticket('door does not close properly', 2),
      ctx: makeCtx().ctx,
      recordLlmCall: () => true,
    });
    expect(result.label).toBe('standard');
  });

  it('honors preClassified input', async () => {
    const t: MaintenanceTicket = {
      ...ticket('cosmetic stuff'),
      preClassified: { category: 'structural', severity: 'urgent' },
    };
    const result = await defaultClassifier.classify({
      input: t,
      ctx: makeCtx().ctx,
      recordLlmCall: () => true,
    });
    expect(result.label).toBe('urgent');
    expect(result.category).toBe('structural');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe('vendorToDispatchCandidate', () => {
  it('scores specialty matches higher than mismatches', () => {
    const vMatch = vendor('v1', 'Plumber Pro', 'plumbing');
    const vMiss = vendor('v2', 'Painter', 'general');
    const classification = {
      label: 'urgent' as const,
      category: 'plumbing' as const,
      confidence: 0.85,
      rationale: '',
    };
    const cMatch = vendorToDispatchCandidate(vMatch, classification);
    const cMiss = vendorToDispatchCandidate(vMiss, classification);
    expect(cMatch.score).toBeGreaterThan(cMiss.score);
  });

  it('tags after-hours vendors in displayName', () => {
    const v = vendor('v1', 'Night Owl', 'plumbing', true);
    const c = vendorToDispatchCandidate(v, {
      label: 'emergency',
      category: 'plumbing',
      confidence: 1,
      rationale: '',
    });
    expect(c.displayName).toContain('[24h]');
  });
});

describe('createMaintenanceDispatch — full pipeline', () => {
  it('triages then dispatches under act-on-yes', async () => {
    const { ctx, recorder } = makeCtx({ mode: 'act-on-yes' });
    const sub = createMaintenanceDispatch({ transport: inMemoryTransport });

    const t = ticket('flood in unit, no water mains');
    const triaged = await sub.triage.run({
      input: t,
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(triaged.output.label).toBe('emergency');

    const candidates = [
      vendor('v1', 'Day Plumber', 'plumbing', false),
      vendor('v2', 'Night Plumber', 'plumbing', true),
      vendor('v3', 'Electric', 'electrical', false),
    ].map((v) => vendorToDispatchCandidate(v, triaged.output));

    const dispatched = await sub.dispatch.run({
      classification: triaged.output,
      candidates,
      payload: { ticketId: t.id },
      inputTenantId: 'tenant-1',
      ctx,
    });
    // Emergency prefers the [24h] vendor.
    expect(dispatched.output.chosen.displayName).toContain('[24h]');
    expect(recorder.entries.length).toBe(2);
    expect(recorder.entries[1]!.status).toBe('awaiting-owner');
  });

  it('drops auto→draft for low-confidence triage', async () => {
    const { ctx, recorder } = makeCtx({ mode: 'auto' });
    const sub = createMaintenanceDispatch({ transport: inMemoryTransport });
    await sub.triage.run({
      input: ticket('paint chipped'), // → cosmetic, confidence 0.7
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(recorder.entries[0]!.status).toBe('draft');
  });
});
