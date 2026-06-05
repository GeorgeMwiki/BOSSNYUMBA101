/**
 * admin-inviolable-tools tests — Wave SOVEREIGN-ADMIN (ported from
 * Borjie G-FIX-5, retargeted to BN's route surfaces).
 *
 * Drives the 8 admin-side inviolable-rule chat tools with an in-memory
 * httpClient stub. Verifies, per tool:
 *
 *   - Each handler returns a stable, validated envelope.
 *   - The two WIRED tools (four_eye.approve, audit.export) hit the real
 *     BN routes; the two chip tools (feature_flag.set, tenant.suspend)
 *     carry BN's canonical PUT/DELETE paths; the four honest-degraded
 *     tools (killswitch.open/close, four_eye.initiate, policy.edit_rule)
 *     set `degraded: true` and never fabricate ids.
 *   - Each schema rejects malformed input.
 *   - HIGH stakes + requiresPolicyRuleLiteral flags are set.
 *   - Persona allowlist is admin-only.
 *   - The catalog contains exactly 8 tools with the expected ids.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  ADMIN_INVIOLABLE_TOOLS,
  adminKillSwitchOpenTool,
  adminKillSwitchCloseTool,
  adminFourEyeInitiateTool,
  adminFourEyeApproveTool,
  adminPolicyEditRuleTool,
  adminFeatureFlagSetTool,
  adminAuditExportTool,
  adminTenantSuspendTool,
} from '../admin-inviolable-tools.js';

const ADMIN_CTX = Object.freeze({
  tenantId: 'tenant-platform',
  actorId: 'admin-mwikila',
  personaSlug: 'T2_admin_strategist',
  chatSessionId: 'sess-admin-1',
  chatTurnId: 'turn-admin-1',
});

function makeClient<T>(postResult: T, getResult: unknown = []) {
  return {
    get: vi.fn(async () => getResult),
    post: vi.fn(async () => postResult),
  };
}

// ──────────────────────────────────────────────────────────────────
// 1) admin.killswitch.open (honest-degraded — no BN REST surface)
// ──────────────────────────────────────────────────────────────────

describe('adminKillSwitchOpenTool', () => {
  it('emits a degraded chip naming the canonical HQ-tool surface, no network', async () => {
    const result = await adminKillSwitchOpenTool.handler(
      { scope: 'platform', reason: 'incident-XYZ — runaway worker', level: 'halt' },
      ADMIN_CTX,
    );
    expect(result.accepted).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.scope).toBe('platform');
    expect(result.level).toBe('halt');
    expect(result.canonicalSurface).toBe('hq-tool:platform.set_killswitch');
    expect(result.noteSw).toMatch(/Kifaa-cha-kuzima/);
    expect(result.noteEn).toMatch(/Kill-switch/);
  });

  it('rejects scopes that are neither "platform" nor "tenant:..."', () => {
    const parsed = adminKillSwitchOpenTool.inputSchema.safeParse({
      scope: 'bad-scope',
      reason: 'r',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects empty reason and unknown keys (strict schema)', () => {
    expect(
      adminKillSwitchOpenTool.inputSchema.safeParse({ scope: 'platform', reason: '' })
        .success,
    ).toBe(false);
    expect(
      adminKillSwitchOpenTool.inputSchema.safeParse({
        scope: 'platform',
        reason: 'r',
        other: 'no',
      }).success,
    ).toBe(false);
  });

  it('is HIGH stakes, write, requires literal policy rule, admin-only', () => {
    expect(adminKillSwitchOpenTool.stakes).toBe('HIGH');
    expect(adminKillSwitchOpenTool.isWrite).toBe(true);
    expect(adminKillSwitchOpenTool.requiresPolicyRuleLiteral).toBe(true);
    expect(adminKillSwitchOpenTool.personaSlugs).toEqual(['T2_admin_strategist']);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2) admin.killswitch.close (honest-degraded)
// ──────────────────────────────────────────────────────────────────

describe('adminKillSwitchCloseTool', () => {
  it('hard-codes level=live and emits a degraded chip', async () => {
    const result = await adminKillSwitchCloseTool.handler(
      { scope: 'tenant:abc', reason: 'incident resolved' },
      ADMIN_CTX,
    );
    expect(result.level).toBe('live');
    expect(result.scope).toBe('tenant:abc');
    expect(result.degraded).toBe(true);
  });

  it('rejects malformed tenant-prefixed scopes', () => {
    expect(
      adminKillSwitchCloseTool.inputSchema.safeParse({
        scope: 'tenants:abc',
        reason: 'r',
      }).success,
    ).toBe(false);
  });

  it('rejects empty scope strings and over-long reasons', () => {
    expect(
      adminKillSwitchCloseTool.inputSchema.safeParse({ scope: '', reason: 'r' })
        .success,
    ).toBe(false);
    expect(
      adminKillSwitchCloseTool.inputSchema.safeParse({
        scope: 'platform',
        reason: 'x'.repeat(500),
      }).success,
    ).toBe(false);
  });

  it('returns bilingual confirmation notes', async () => {
    const result = await adminKillSwitchCloseTool.handler(
      { scope: 'platform', reason: 'rollback OK' },
      ADMIN_CTX,
    );
    expect(result.noteSw).toMatch(/Kurejesha/);
    expect(result.noteEn).toMatch(/return-to-live/);
  });
});

// ──────────────────────────────────────────────────────────────────
// 3) admin.four_eye.initiate (honest-degraded → admin-superpowers queue)
// ──────────────────────────────────────────────────────────────────

describe('adminFourEyeInitiateTool', () => {
  it('emits a degraded chip pointing at the admin-superpowers propose surface', async () => {
    const result = await adminFourEyeInitiateTool.handler(
      {
        actionType: 'payment.large',
        secondApproverId: 'user-mary',
        payload: { amountTzs: 8_000_000, recipient: 'vendor-X' },
        reason: 'CapEx batch run',
      },
      ADMIN_CTX,
    );
    expect(result.accepted).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.actionType).toBe('payment.large');
    expect(result.secondApproverId).toBe('user-mary');
    expect(result.canonicalSurface).toMatch(/admin\/superpowers\/bulk-action/);
    expect(result.noteSw).toMatch(/macho-manne/);
  });

  it('rejects unknown actionType', () => {
    expect(
      adminFourEyeInitiateTool.inputSchema.safeParse({
        actionType: 'payment.tiny',
        secondApproverId: 'u',
        payload: {},
        reason: 'r',
      }).success,
    ).toBe(false);
  });

  it('rejects ttlMinutes outside the 15-min..7-day window', () => {
    expect(
      adminFourEyeInitiateTool.inputSchema.safeParse({
        actionType: 'payment.large',
        secondApproverId: 'u',
        payload: {},
        reason: 'r',
        ttlMinutes: 5,
      }).success,
    ).toBe(false);
    expect(
      adminFourEyeInitiateTool.inputSchema.safeParse({
        actionType: 'payment.large',
        secondApproverId: 'u',
        payload: {},
        reason: 'r',
        ttlMinutes: 60 * 24 * 30,
      }).success,
    ).toBe(false);
  });

  it('flags HIGH-risk + policy-literal + admin-only', () => {
    expect(adminFourEyeInitiateTool.stakes).toBe('HIGH');
    expect(adminFourEyeInitiateTool.requiresPolicyRuleLiteral).toBe(true);
    expect(adminFourEyeInitiateTool.personaSlugs).toEqual(['T2_admin_strategist']);
  });
});

// ──────────────────────────────────────────────────────────────────
// 4) admin.four_eye.approve (WIRED → /admin/superpowers/approve/:journalId)
// ──────────────────────────────────────────────────────────────────

describe('adminFourEyeApproveTool', () => {
  it('throws without httpClient', async () => {
    await expect(
      adminFourEyeApproveTool.handler({ journalId: 'j1' }, ADMIN_CTX),
    ).rejects.toThrow(/requires httpClient/);
  });

  it('encodes the journalId in the BN approve path and posts a decisionNote body', async () => {
    const client = makeClient({
      data: {
        applied: true,
        journalId: 'j1',
        pendingId: 'p1',
        action: 'suspend_tenant_org',
        targetEntityRef: 'tenant_org:acme',
        approvedAt: '2026-05-29T13:00:00Z',
      },
    });
    const result = await adminFourEyeApproveTool.handler(
      { journalId: 'j1', note: 'OK after rec' },
      { ...ADMIN_CTX, httpClient: client },
    );
    expect(client.post).toHaveBeenCalledWith(
      '/admin/superpowers/approve/j1',
      expect.objectContaining({
        decisionNote: 'OK after rec',
        provenance: expect.objectContaining({ via: 'chat' }),
      }),
    );
    expect(result.approved).toBe(true);
    expect(result.journalId).toBe('j1');
    expect(result.action).toBe('suspend_tenant_org');
    expect(result.approvedAt).toBe('2026-05-29T13:00:00Z');
  });

  it('rejects empty journalId and unknown keys', () => {
    expect(
      adminFourEyeApproveTool.inputSchema.safeParse({ journalId: '' }).success,
    ).toBe(false);
    expect(
      adminFourEyeApproveTool.inputSchema.safeParse({
        journalId: 'j1',
        other: 'no',
      }).success,
    ).toBe(false);
  });

  it('renders bilingual approval notes', async () => {
    const client = makeClient({ data: { applied: true, journalId: 'j2' } });
    const result = await adminFourEyeApproveTool.handler(
      { journalId: 'j2' },
      { ...ADMIN_CTX, httpClient: client },
    );
    expect(result.noteSw).toMatch(/Idhini ya macho-manne/);
    expect(result.noteEn).toMatch(/Four-eye approval/);
  });
});

// ──────────────────────────────────────────────────────────────────
// 5) admin.policy.edit_rule (honest-degraded — kernel policy-gate)
// ──────────────────────────────────────────────────────────────────

describe('adminPolicyEditRuleTool', () => {
  it('emits a degraded chip referencing the kernel policy-gate, no network', async () => {
    const result = await adminPolicyEditRuleTool.handler(
      {
        ruleId: 'kill_switch.tenant.payment_freeze',
        changeJson: { threshold: 10_000_000 },
        reason: 'raise threshold',
        secondApproverId: 'user-bob',
      },
      ADMIN_CTX,
    );
    expect(result.accepted).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.ruleId).toBe('kill_switch.tenant.payment_freeze');
    expect(result.canonicalSurface).toMatch(/policy-gate/);
  });

  it('rejects empty ruleId + reason', () => {
    expect(
      adminPolicyEditRuleTool.inputSchema.safeParse({
        ruleId: '',
        changeJson: {},
        reason: 'r',
        secondApproverId: 'u',
      }).success,
    ).toBe(false);
    expect(
      adminPolicyEditRuleTool.inputSchema.safeParse({
        ruleId: 'x',
        changeJson: {},
        reason: '',
        secondApproverId: 'u',
      }).success,
    ).toBe(false);
  });

  it('requires literal policy rule (CLAUDE.md hard rule)', () => {
    expect(adminPolicyEditRuleTool.requiresPolicyRuleLiteral).toBe(true);
    expect(adminPolicyEditRuleTool.stakes).toBe('HIGH');
  });

  it('renders bilingual confirmation notes referencing the ruleId', async () => {
    const result = await adminPolicyEditRuleTool.handler(
      { ruleId: 'rule-X', changeJson: { a: 1 }, reason: 'r', secondApproverId: 'u' },
      ADMIN_CTX,
    );
    expect(result.noteEn).toMatch(/rule-X/);
    expect(result.noteSw).toMatch(/rule-X/);
    expect(result.noteSw).toMatch(/Mabadiliko/);
  });
});

// ──────────────────────────────────────────────────────────────────
// 6) admin.feature_flag.set — chip envelope (BN canonical PUT path)
// ──────────────────────────────────────────────────────────────────

describe('adminFeatureFlagSetTool', () => {
  it('emits a chip carrying the BN PUT path without hitting the network', async () => {
    const result = await adminFeatureFlagSetTool.handler(
      {
        flagKey: 'cockpit.dynamic-tabs',
        value: true,
        rolloutPct: 25,
        reason: 'phased rollout',
      },
      ADMIN_CTX,
    );
    expect(result.accepted).toBe(true);
    expect(result.flagKey).toBe('cockpit.dynamic-tabs');
    expect(result.targetValue).toBe(true);
    expect(result.targetRolloutPct).toBe(25);
    expect(result.httpMethod).toBe('PUT');
    expect(result.httpPath).toBe('/api/v1/feature-flags/cockpit.dynamic-tabs');
  });

  it('rejects rolloutPct outside 0..100', () => {
    expect(
      adminFeatureFlagSetTool.inputSchema.safeParse({
        flagKey: 'x',
        value: true,
        rolloutPct: -1,
        reason: 'r',
      }).success,
    ).toBe(false);
    expect(
      adminFeatureFlagSetTool.inputSchema.safeParse({
        flagKey: 'x',
        value: true,
        rolloutPct: 101,
        reason: 'r',
      }).success,
    ).toBe(false);
  });

  it('rejects empty flagKey and unknown extras', () => {
    expect(
      adminFeatureFlagSetTool.inputSchema.safeParse({
        flagKey: '',
        value: true,
        reason: 'r',
      }).success,
    ).toBe(false);
    expect(
      adminFeatureFlagSetTool.inputSchema.safeParse({
        flagKey: 'x',
        value: true,
        reason: 'r',
        other: 'no',
      }).success,
    ).toBe(false);
  });

  it('is HIGH stakes + policy-literal admin-only with a PUT chip', () => {
    expect(adminFeatureFlagSetTool.stakes).toBe('HIGH');
    expect(adminFeatureFlagSetTool.requiresPolicyRuleLiteral).toBe(true);
    expect(adminFeatureFlagSetTool.personaSlugs).toEqual(['T2_admin_strategist']);
  });
});

// ──────────────────────────────────────────────────────────────────
// 7) admin.audit.export (WIRED → GET /admin/audit/log)
// ──────────────────────────────────────────────────────────────────

describe('adminAuditExportTool', () => {
  it('probes the BN audit log and emits a download-ready chip', async () => {
    const client = makeClient(undefined, [{ id: 'audit-1' }]);
    const result = await adminAuditExportTool.handler(
      { from: '2026-05-01', to: '2026-05-29', format: 'csv', reason: 'PCCB monthly export' },
      { ...ADMIN_CTX, httpClient: client },
    );
    expect(client.get).toHaveBeenCalledWith(
      '/admin/audit/log',
      expect.objectContaining({
        query: expect.objectContaining({ since: '2026-05-01', until: '2026-05-29', limit: 1 }),
      }),
    );
    expect(result.accepted).toBe(true);
    expect(result.format).toBe('csv');
    expect(result.rowsPreviewCount).toBe(1);
  });

  it('tolerates probe failures without throwing', async () => {
    const client = {
      get: vi.fn(async () => {
        throw new Error('probe boom');
      }),
      post: vi.fn(async () => ({})),
    };
    const result = await adminAuditExportTool.handler(
      { from: '2026-05-01', to: '2026-05-29', format: 'json', reason: 'self-test' },
      { ...ADMIN_CTX, httpClient: client },
    );
    expect(result.accepted).toBe(true);
    expect(result.rowsPreviewCount).toBe(0);
  });

  it('rejects formats outside csv|json|pdf', () => {
    expect(
      adminAuditExportTool.inputSchema.safeParse({
        from: '2026-05-01',
        to: '2026-05-29',
        format: 'xlsx',
        reason: 'r',
      }).success,
    ).toBe(false);
  });

  it('rejects empty from/to/reason and unknown keys', () => {
    expect(
      adminAuditExportTool.inputSchema.safeParse({
        from: '',
        to: '2026-05-29',
        format: 'csv',
        reason: 'r',
      }).success,
    ).toBe(false);
    expect(
      adminAuditExportTool.inputSchema.safeParse({
        from: '2026-05-01',
        to: '2026-05-29',
        format: 'csv',
        reason: 'r',
        other: 'no',
      }).success,
    ).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 8) admin.tenant.suspend — chip envelope (BN canonical DELETE path)
// ──────────────────────────────────────────────────────────────────

describe('adminTenantSuspendTool', () => {
  it('emits a DELETE chip with 30-day default grace', async () => {
    const result = await adminTenantSuspendTool.handler(
      { tenantId: 'tenant-acme', reason: 'abuse — confirmed' },
      ADMIN_CTX,
    );
    expect(result.accepted).toBe(true);
    expect(result.tenantId).toBe('tenant-acme');
    expect(result.graceDays).toBe(30);
    expect(result.httpMethod).toBe('DELETE');
    expect(result.httpPath).toBe('/api/v1/tenants/tenant-acme');
  });

  it('honours a longer grace window when requested', async () => {
    const result = await adminTenantSuspendTool.handler(
      { tenantId: 't1', reason: 'regulator pause', graceDays: 120 },
      ADMIN_CTX,
    );
    expect(result.graceDays).toBe(120);
  });

  it('rejects graceDays shorter than the PDPA minimum (30) or over the cap (180)', () => {
    expect(
      adminTenantSuspendTool.inputSchema.safeParse({
        tenantId: 't',
        reason: 'r',
        graceDays: 7,
      }).success,
    ).toBe(false);
    expect(
      adminTenantSuspendTool.inputSchema.safeParse({
        tenantId: 't',
        reason: 'r',
        graceDays: 365,
      }).success,
    ).toBe(false);
  });

  it('renders bilingual confirmation notes', async () => {
    const result = await adminTenantSuspendTool.handler(
      { tenantId: 't', reason: 'r' },
      ADMIN_CTX,
    );
    expect(result.noteSw).toMatch(/Kusimamishwa/);
    expect(result.noteEn).toMatch(/suspension scheduled/);
  });
});

// ──────────────────────────────────────────────────────────────────
// Catalog integrity
// ──────────────────────────────────────────────────────────────────

describe('ADMIN_INVIOLABLE_TOOLS catalog', () => {
  it('exports exactly 8 tools with the documented ids', () => {
    const ids = ADMIN_INVIOLABLE_TOOLS.map((t) => t.id).sort();
    expect(ids).toEqual([
      'admin.audit.export',
      'admin.feature_flag.set',
      'admin.four_eye.approve',
      'admin.four_eye.initiate',
      'admin.killswitch.close',
      'admin.killswitch.open',
      'admin.policy.edit_rule',
      'admin.tenant.suspend',
    ]);
  });

  it('every entry is HIGH stakes, write, policy-literal, admin-only', () => {
    for (const tool of ADMIN_INVIOLABLE_TOOLS) {
      expect(tool.stakes).toBe('HIGH');
      expect(tool.isWrite).toBe(true);
      expect(tool.requiresPolicyRuleLiteral).toBe(true);
      expect([...tool.personaSlugs]).toEqual(['T2_admin_strategist']);
    }
  });
});
