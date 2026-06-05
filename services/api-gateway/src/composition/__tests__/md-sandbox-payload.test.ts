/**
 * md-sandbox-payload — commit-time payload validator tests.
 *
 * The sandbox commit MUST validate the staged payload (shape via zod) and
 * strip reserved columns BEFORE the atomic real-table write. These tests
 * pin that contract: reserved columns never reach the target; bad enums /
 * missing required fields are rejected; UPDATE accepts a partial patch.
 */
import { describe, expect, it } from 'vitest';

import {
  validateSandboxPayload,
  isSandboxTargetTable,
  RESERVED_PAYLOAD_COLUMNS,
} from '../md-sandbox-payload.js';

describe('isSandboxTargetTable', () => {
  it('accepts the gap-2 org/team tables only', () => {
    expect(isSandboxTargetTable('staff_members')).toBe(true);
    expect(isSandboxTargetTable('staff_kpis')).toBe(true);
    expect(isSandboxTargetTable('org_tasks')).toBe(true);
    expect(isSandboxTargetTable('org_escalations')).toBe(true);
    expect(isSandboxTargetTable('tenants')).toBe(false);
    expect(isSandboxTargetTable('ledger_entries')).toBe(false);
  });
});

describe('validateSandboxPayload — staff_members', () => {
  it('strips reserved columns the brain must never set', () => {
    const res = validateSandboxPayload('staff_members', 'insert', {
      full_name: 'Asha',
      role: 'caretaker',
      // every one of these must be stripped:
      id: 'forged-id',
      tenant_id: 'another-tenant',
      created_at: '2000-01-01',
      updated_at: '2000-01-01',
      audit_hash_id: 'forged-hash',
      provenance: { via: 'forged' },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      for (const reserved of RESERVED_PAYLOAD_COLUMNS) {
        expect(res.payload).not.toHaveProperty(reserved);
      }
      expect(res.payload.full_name).toBe('Asha');
      expect(res.payload.role).toBe('caretaker');
    }
  });

  it('rejects an insert missing a required field (role)', () => {
    const res = validateSandboxPayload('staff_members', 'insert', {
      full_name: 'Asha',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain('staff_members insert');
  });

  it('rejects an unknown column via strict()', () => {
    const res = validateSandboxPayload('staff_members', 'insert', {
      full_name: 'Asha',
      role: 'caretaker',
      salary: 999999,
    });
    expect(res.ok).toBe(false);
  });

  it('accepts a partial patch on UPDATE', () => {
    const res = validateSandboxPayload('staff_members', 'update', {
      role: 'leasing_assistant',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.payload.role).toBe('leasing_assistant');
  });
});

describe('validateSandboxPayload — staff_kpis', () => {
  it('requires staff_member_id + positive target_value', () => {
    const bad = validateSandboxPayload('staff_kpis', 'insert', {
      staff_member_id: '11111111-1111-1111-1111-111111111111',
      name: 'Units leased',
      target_value: -1,
    });
    expect(bad.ok).toBe(false);

    const good = validateSandboxPayload('staff_kpis', 'insert', {
      staff_member_id: '11111111-1111-1111-1111-111111111111',
      name: 'Units leased',
      target_value: 12,
      metric_unit: 'count',
    });
    expect(good.ok).toBe(true);
  });

  it('rejects a bad metric_unit enum', () => {
    const res = validateSandboxPayload('staff_kpis', 'insert', {
      staff_member_id: '11111111-1111-1111-1111-111111111111',
      name: 'x',
      target_value: 1,
      metric_unit: 'bitcoin',
    });
    expect(res.ok).toBe(false);
  });
});

describe('validateSandboxPayload — org_escalations', () => {
  it('requires title + reason and validates category', () => {
    const res = validateSandboxPayload('org_escalations', 'insert', {
      title: 'Smoke alarm',
      reason: 'Dead alarm, safety risk.',
      category: 'maintenance_incident',
      severity: 'high',
    });
    expect(res.ok).toBe(true);

    const bad = validateSandboxPayload('org_escalations', 'insert', {
      title: 'x',
      reason: 'y',
      category: 'nonsense',
    });
    expect(bad.ok).toBe(false);
  });
});

describe('validateSandboxPayload — empty after stripping', () => {
  it('rejects a payload that is only reserved columns', () => {
    const res = validateSandboxPayload('org_tasks', 'insert', {
      id: 'x',
      tenant_id: 'y',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain('reserved columns');
  });
});
