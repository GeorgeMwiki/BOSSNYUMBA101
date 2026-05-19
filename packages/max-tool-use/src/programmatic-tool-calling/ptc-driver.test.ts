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
  correlationId: 'corr-abc',
};

function vendorTool(): DomainToolHandler {
  return {
    name: 'vendor_research',
    async invoke(_input, _c) {
      return { vendor: 'AquaFix', rating: 4.3 };
    },
  };
}

function ledgerTool(): DomainToolHandler {
  return {
    name: 'tenant_ledger',
    async invoke(_input, _c) {
      return { tenantId: 'T-101', balance: 15000 };
    },
  };
}

function notifyTool(): DomainToolHandler {
  return {
    name: 'draft_notice',
    async invoke(_input, _c) {
      return { draftId: 'd-1' };
    },
  };
}

describe('createPtcDriver — basic shape', () => {
  it('runs a single-tool PTC session and reports zero round-trips saved', async () => {
    const driver = createPtcDriver();
    const req: PtcRequest = {
      task: 'evaluate a vendor',
      tools: [vendorTool()],
      model: 'claude-opus-4-7',
      ctx,
    };
    const res = await driver.runPTCSession(req);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.stepsExecuted).toBe(1);
    expect(res.value.roundTripsSaved).toBe(0);
    expect(res.value.toolCalls).toHaveLength(1);
  });

  it('runs a multi-tool PTC session saving N-1 round trips', async () => {
    const driver = createPtcDriver();
    const req: PtcRequest = {
      task: 'vendor research + billing run',
      tools: [vendorTool(), ledgerTool(), notifyTool()],
      model: 'claude-opus-4-7',
      ctx,
    };
    const res = await driver.runPTCSession(req);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.stepsExecuted).toBe(3);
    expect(res.value.roundTripsSaved).toBe(2);
  });

  it('returns INVALID_TASK when task is empty', async () => {
    const driver = createPtcDriver();
    const res = await driver.runPTCSession({
      task: '   ',
      tools: [vendorTool()],
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('INVALID_TASK');
  });

  it('returns NO_TOOLS when tool array is empty', async () => {
    const driver = createPtcDriver();
    const res = await driver.runPTCSession({
      task: 't',
      tools: [],
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NO_TOOLS');
  });

  it('emits a Python program that contains all tool names', async () => {
    const driver = createPtcDriver();
    const res = await driver.runPTCSession({
      task: 'compute occupancy for the portfolio',
      tools: [vendorTool(), ledgerTool()],
      model: 'claude-sonnet-4-6',
      ctx,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.pythonProgram).toContain('vendor_research');
    expect(res.value.pythonProgram).toContain('tenant_ledger');
  });

  it('respects maxIterations to cap tool fan-out', async () => {
    const driver = createPtcDriver();
    const res = await driver.runPTCSession({
      task: 'fan-out test',
      tools: [vendorTool(), ledgerTool(), notifyTool()],
      model: 'claude-opus-4-7',
      maxIterations: 2,
      ctx,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.stepsExecuted).toBe(2);
  });

  it('preserves correlationId in telemetry', async () => {
    const driver = createPtcDriver();
    const res = await driver.runPTCSession({
      task: 't',
      tools: [vendorTool()],
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.telemetry.correlationId).toBe('corr-abc');
  });

  it('uses the injected pythonEmitter when supplied', async () => {
    const driver = createPtcDriver();
    const res = await driver.runPTCSession({
      task: 't',
      tools: [vendorTool()],
      model: 'claude-opus-4-7',
      ctx,
      pythonEmitter: () => '# CUSTOM',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.pythonProgram).toBe('# CUSTOM');
  });

  it('delegates Python emission to the anthropic call when injected', async () => {
    const driver = createPtcDriver({
      anthropicCall: async ({ task }) => ({
        pythonProgram: `# SDK-driven program for ${task}`,
        finalText: 'sdk text',
      }),
    });
    const res = await driver.runPTCSession({
      task: 'vendor research',
      tools: [vendorTool()],
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.pythonProgram).toContain('SDK-driven program');
  });

  it('estimates higher cost for opus than sonnet for the same workload', async () => {
    const driver = createPtcDriver();
    const opus = await driver.runPTCSession({
      task: 't',
      tools: [vendorTool()],
      model: 'claude-opus-4-7',
      ctx,
    });
    const sonnet = await driver.runPTCSession({
      task: 't',
      tools: [vendorTool()],
      model: 'claude-sonnet-4-6',
      ctx,
    });
    expect(opus.ok && sonnet.ok).toBe(true);
    if (opus.ok && sonnet.ok) {
      expect(opus.telemetry.estimatedCostUsd).toBeGreaterThan(
        sonnet.telemetry.estimatedCostUsd,
      );
    }
  });
});
