/**
 * Tests for Module 10 — Anti-Scheming Dashboard view-models.
 */
import { describe, it, expect } from 'vitest';
import {
  toTenantSnapshot,
  toPlatformSnapshot,
  toCapabilityCard,
} from '../anti-scheming-dashboard/index.js';

function baseInput(overrides: Partial<Parameters<typeof toTenantSnapshot>[0]> = {}) {
  return {
    tenant_id: 't1', tenant_name: 'Acme',
    probes_passed_24h: 10, probes_total_24h: 10,
    auditor_passed_24h: 50, auditor_total_24h: 50,
    auditor_previous_pass_rate: 1.0,
    self_correction_triggers_24h: 0,
    sleeper_flags_24h: 0,
    real_traffic_pass_rate_24h: 1.0,
    autonomy_level: 'full',
    ...overrides,
  };
}

describe('dashboard view-models', () => {
  it('green on all-passing metrics', () => {
    const t = toTenantSnapshot(baseInput());
    expect(t.status).toBe('green');
  });

  it('red on sleeper flag', () => {
    const t = toTenantSnapshot(baseInput({ sleeper_flags_24h: 1 }));
    expect(t.status).toBe('red');
  });

  it('red on >=5pp auditor regression', () => {
    const t = toTenantSnapshot(baseInput({ auditor_passed_24h: 45, auditor_previous_pass_rate: 1.0 }));
    expect(t.status).toBe('red');
  });

  it('amber on 2-5pp regression', () => {
    const t = toTenantSnapshot(baseInput({ auditor_passed_24h: 48, auditor_previous_pass_rate: 1.0 }));
    expect(t.status).toBe('amber');
  });

  it('red on |behaviour_delta| >= 5pp', () => {
    const t = toTenantSnapshot(baseInput({ probes_passed_24h: 5, probes_total_24h: 10, real_traffic_pass_rate_24h: 0.95 }));
    expect(t.status).toBe('red');
    expect(Math.abs(t.behaviour_delta_pp_24h)).toBeGreaterThanOrEqual(0.05);
  });

  it('amber on 3 self-correction triggers', () => {
    const t = toTenantSnapshot(baseInput({ self_correction_triggers_24h: 3 }));
    expect(t.status).toBe('amber');
  });

  it('handles zero totals gracefully', () => {
    const t = toTenantSnapshot(baseInput({ probes_total_24h: 0, probes_passed_24h: 0, auditor_total_24h: 0, auditor_passed_24h: 0 }));
    expect(t.probe_pass_rate_24h).toBe(1);
    expect(t.auditor_pass_rate_24h).toBe(1);
  });

  it('platform snapshot rolls up tenant statuses', () => {
    const tenants = [
      toTenantSnapshot(baseInput({ tenant_id: 'a' })),
      toTenantSnapshot(baseInput({ tenant_id: 'b', sleeper_flags_24h: 1 })),
      toTenantSnapshot(baseInput({ tenant_id: 'c', self_correction_triggers_24h: 3 })),
    ];
    const p = toPlatformSnapshot(tenants, []);
    expect(p.tenants_total).toBe(3);
    expect(p.tenants_red).toBeGreaterThan(0);
    expect(p.tenants_amber).toBeGreaterThan(0);
  });

  it('capability card includes status-coloured footnote', () => {
    const card = toCapabilityCard(toTenantSnapshot(baseInput({ sleeper_flags_24h: 2 })));
    expect(card.footnote.toLowerCase()).toContain('red');
    expect(card.footnote).toContain('sleeper');
  });

  it('amber footnote mentions delta', () => {
    const card = toCapabilityCard(toTenantSnapshot(baseInput({ self_correction_triggers_24h: 4 })));
    expect(card.footnote).toContain('amber');
  });
});
