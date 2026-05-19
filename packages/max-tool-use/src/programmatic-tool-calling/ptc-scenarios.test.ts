/**
 * 6 representative PTC sessions (per M-C task contract):
 *
 *   1. Vendor research
 *   2. Batch billing
 *   3. Multi-property occupancy compute
 *   4. Monthly KRA preparation
 *   5. Lease renewal sweep
 *   6. Mass tenant comms scheduling
 */

import { describe, expect, it } from 'vitest';
import { createPtcDriver } from './ptc-driver.js';
import type {
  DomainToolHandler,
  PtcRequest,
  TenantContext,
} from '../types.js';

const ctx: TenantContext = {
  tenantId: 'tnt-acme',
  principalId: 'usr-1',
  correlationId: 'corr-scenarios',
};

function tool(name: string, output: unknown): DomainToolHandler {
  return {
    name,
    invoke: async () => output,
  };
}

const driver = createPtcDriver();

async function run(req: PtcRequest) {
  const r = await driver.runPTCSession(req);
  if (!r.ok) {
    throw new Error(`PTC failed: ${r.error.code}`);
  }
  return r.value;
}

describe('PTC scenarios — 6 representative sessions', () => {
  it('Scenario 1: vendor research session', async () => {
    const out = await run({
      task: 'evaluate AquaFix plumbing vendor',
      tools: [
        tool('web_search', { hits: 4 }),
        tool('kra_lookup', { vatActive: true }),
        tool('nls_license_check', { licensed: true }),
      ],
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(out.stepsExecuted).toBe(3);
    expect(out.roundTripsSaved).toBe(2);
  });

  it('Scenario 2: batch billing run', async () => {
    const tenants = ['T-001', 'T-002', 'T-003', 'T-004'];
    const out = await run({
      task: 'draft monthly bills',
      tools: tenants.map((t) =>
        tool(`tenant_${t.toLowerCase()}_bill`, { id: t, amount: 50000 }),
      ),
      model: 'claude-sonnet-4-6',
      ctx,
    });
    expect(out.stepsExecuted).toBe(4);
    expect(out.roundTripsSaved).toBe(3);
  });

  it('Scenario 3: multi-property occupancy compute', async () => {
    const out = await run({
      task: 'compute occupancy across 5 properties',
      tools: [
        tool('property_block_a', { units: 24, occupied: 22 }),
        tool('property_block_b', { units: 30, occupied: 28 }),
        tool('property_block_c', { units: 18, occupied: 15 }),
        tool('property_block_d', { units: 12, occupied: 11 }),
        tool('property_block_e', { units: 20, occupied: 19 }),
      ],
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(out.stepsExecuted).toBe(5);
    expect(out.roundTripsSaved).toBe(4);
    expect(out.pythonProgram).toContain('property_block_a');
    expect(out.pythonProgram).toContain('property_block_e');
  });

  it('Scenario 4: monthly KRA TOT prep', async () => {
    const out = await run({
      task: 'prepare monthly KRA TOT return',
      tools: [
        tool('tenant_ledger_export', { rows: 120 }),
        tool('exchange_rate_lookup', { kesUsd: 130 }),
        tool('vat_eligible_compute', { vatPortion: 0.08 }),
        tool('return_pdf_render', { pdf: 'KRA-TOT.pdf' }),
      ],
      model: 'claude-sonnet-4-6',
      ctx,
    });
    expect(out.stepsExecuted).toBe(4);
  });

  it('Scenario 5: lease renewal sweep', async () => {
    const out = await run({
      task: 'sweep leases expiring in 60 days',
      tools: [
        tool('lease_expiring_list', { rows: 7 }),
        tool('rent_review_compute', { increase: 0.05 }),
        tool('renewal_letter_render', { letters: 7 }),
      ],
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(out.stepsExecuted).toBe(3);
    expect(out.pythonProgram).toContain('lease_expiring_list');
  });

  it('Scenario 6: mass tenant comms scheduling', async () => {
    const out = await run({
      task: 'schedule Diwali holiday notice',
      tools: [
        tool('tenants_active', { count: 200 }),
        tool('whatsapp_template_resolve', { template: 'diwali-2026' }),
        tool('schedule_send', { jobId: 'job-99' }),
      ],
      model: 'claude-haiku-4-5',
      ctx,
    });
    expect(out.stepsExecuted).toBe(3);
  });
});
