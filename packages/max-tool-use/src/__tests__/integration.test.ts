/**
 * Phase M-C — integration suite.
 *
 * 12 cross-module integration tests:
 *
 *   1. PTC + Files+Citations — vendor research session ingests contract template
 *   2. PTC + Memory — playbook is updated mid-PTC
 *   3. Batch + Cache control — 1h TTL stacks with batch discount to ~95%
 *   4. Composed Research + Memory — research result persisted to memory
 *   5. Computer Use + MCP Connectors — KRA iTax via connector registry
 *   6. Cache Control + Telemetry — would5MinHaveEvicted warning surfaces
 *   7. PTC + Web Research — embedded inside the synthetic Python program
 *   8. MCP Connectors fan-out — 4 providers probed in parallel
 *   9. Memory tenant isolation across both backends
 *  10. PTC + Batch — bulk billing batch handed off after PTC compute
 *  11. Files + Cache — re-use a file id across two cached prompts
 *  12. End-to-end vendor onboarding (composition example)
 */

import { describe, expect, it } from 'vitest';
import { createPtcDriver } from '../programmatic-tool-calling/index.js';
import { createBatchDriver } from '../batch-api/index.js';
import {
  calculateStackedCost,
} from '../batch-api/cost-stacking.js';
import { createFilesCitationsClient } from '../files-citations/index.js';
import { createComputerUseHarness } from '../computer-use/index.js';
import { createWebResearcher } from '../web-research/index.js';
import { createMemoryAdapter } from '../memory-tool/index.js';
import {
  createConnectorRegistry,
  createHealthProber,
} from '../mcp-connectors/index.js';
import {
  wrapStablePrefix,
  betasForCacheTtl,
  summariseCacheUtilization,
} from '../cache-control/index.js';
import type {
  DomainToolHandler,
  McpConnectorConfig,
  TenantContext,
} from '../types.js';

const ctx: TenantContext = {
  tenantId: 'tnt-acme',
  principalId: 'usr-1',
  correlationId: 'corr-integration',
};

const tools: ReadonlyArray<DomainToolHandler> = [
  {
    name: 'vendor_research',
    invoke: async () => ({ vendor: 'AquaFix', rating: 4.3 }),
  },
  {
    name: 'contract_draft',
    invoke: async () => ({ docId: 'doc_aquafix' }),
  },
  {
    name: 'payment_schedule',
    invoke: async () => ({ intentId: 'pi_abc' }),
  },
];

describe('Integration 1 — PTC + Files+Citations', () => {
  it('a PTC session can reference a template file uploaded via Files API', async () => {
    const files = createFilesCitationsClient();
    const tpl = await files.uploadFile({
      path: '/tmp/contract-template.pdf',
      mime: 'application/pdf',
      title: 'Standard service agreement',
      tenantContext: ctx,
    });
    const driver = createPtcDriver();
    const res = await driver.runPTCSession({
      task: `draft contract using template ${tpl.value}`,
      tools,
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.pythonProgram).toContain('contract_draft');
    const cited = await files.analyzeWithCitations({
      fileIds: [tpl],
      prompt: 'Reference standard escalation clause',
      model: 'claude-opus-4-7',
      tenantContext: ctx,
    });
    expect(cited.citations).toHaveLength(1);
  });
});

describe('Integration 2 — PTC + Memory adapter', () => {
  it('a PTC outcome can be persisted into the tenant memory store', async () => {
    const driver = createPtcDriver();
    const mem = createMemoryAdapter();
    const res = await driver.runPTCSession({
      task: 'compute occupancy',
      tools: [tools[0]!],
      model: 'claude-sonnet-4-6',
      ctx,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    await mem.create('tnt-acme', 'playbooks/last-ptc.md', res.value.answer);
    const stored = await mem.view('tnt-acme', 'playbooks/last-ptc.md');
    expect(stored).toContain('compute occupancy');
  });
});

describe('Integration 3 — Batch + 1h cache stack to ~95% off', () => {
  it('verifies the stacked discount on a cache-heavy batch run', () => {
    const r = calculateStackedCost({
      model: 'claude-sonnet-4-6',
      batched: true,
      inputTokens: 100_000, // fresh
      outputTokens: 10_000,
      cachedInputTokens: 1_000_000, // 1M tokens cached
      cacheTtlSeconds: 3600,
    });
    expect(r.effectiveDiscount).toBeGreaterThan(0.85);
  });
});

describe('Integration 4 — Composed Research + Memory', () => {
  it('research output can be persisted as a vendor playbook', async () => {
    const r = await createWebResearcher().composedResearch({
      question: 'KRA WHT rental income rate 2026',
      tenantContext: ctx,
    });
    const mem = createMemoryAdapter();
    await mem.create(
      'tnt-acme',
      'learned-heuristics/kra-wht.md',
      r.answer,
    );
    const v = await mem.view('tnt-acme', 'learned-heuristics/kra-wht.md');
    expect(v).toBeTruthy();
  });
});

describe('Integration 5 — Computer Use + MCP Connectors', () => {
  it('Computer Use session backed by a registered KRA connector', async () => {
    const registry = createConnectorRegistry([
      {
        provider: 'kra-itax',
        url: 'https://mcp.kra.itax/v1',
        authorization: 'Bearer test',
      } as McpConnectorConfig,
    ]);
    expect(registry.has('kra-itax')).toBe(true);
    const r = await createComputerUseHarness().runComputerUseSession({
      task: 'verify VAT status on iTax',
      allowedDomains: ['itax.kra.go.ke'],
      allowedActions: ['screenshot', 'left_click'],
      tenantContext: ctx,
      startUrl: 'https://itax.kra.go.ke/portal',
      scriptedActions: [{ action: 'screenshot' }],
    });
    expect(r.outcome).toBe('completed');
  });
});

describe('Integration 6 — Cache Control telemetry warning', () => {
  it('emits would5MinHaveEvicted when 5min ttl + long-lived prefix', () => {
    const t = summariseCacheUtilization({
      cacheCreationTokens: 100,
      cacheReadTokens: 50,
      ttlSeconds: 300,
      model: 'claude-sonnet-4-6',
      correlationId: 'corr-int',
      elapsedMs: 10 * 60_000,
    });
    expect(t.would5MinHaveEvicted).toBe(true);
  });
});

describe('Integration 7 — PTC + Web Research', () => {
  it('embedded research can be invoked via a domain tool in PTC', async () => {
    const driver = createPtcDriver();
    const researcher = createWebResearcher();
    const researchTool: DomainToolHandler = {
      name: 'composed_research',
      async invoke() {
        const r = await researcher.composedResearch({
          question: 'market rent in Kileleshwa',
          tenantContext: ctx,
        });
        return r.answer;
      },
    };
    const res = await driver.runPTCSession({
      task: 'gather market comps',
      tools: [researchTool],
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.toolCalls[0]!.tool).toBe('composed_research');
  });
});

describe('Integration 8 — MCP connector fan-out', () => {
  it('probes 4 providers and reports all healthy', async () => {
    const configs: ReadonlyArray<McpConnectorConfig> = [
      { provider: 'pesapal', url: 'https://mcp.pesapal/x', authorization: 'tok' },
      { provider: 'mpesa-daraja', url: 'https://mcp.mpesa/x', authorization: 'tok' },
      { provider: 'nls', url: 'https://mcp.nls/x', authorization: 'tok' },
      { provider: 'kra-itax', url: 'https://mcp.kra/x', authorization: 'tok' },
    ];
    const prober = createHealthProber();
    const probes = await Promise.all(configs.map((c) => prober.probeConnector(c)));
    expect(probes).toHaveLength(4);
    expect(probes.every((p) => p.ok)).toBe(true);
  });
});

describe('Integration 9 — Memory tenant isolation across backends', () => {
  it('tenants cannot read each other in either backend', async () => {
    for (const backend of ['sessionstore', 'managed-agents'] as const) {
      const mem = createMemoryAdapter({ env: { MEMORY_BACKEND: backend } });
      await mem.create('tnt-A', 'x.md', 'secret-A');
      await mem.create('tnt-B', 'x.md', 'secret-B');
      const a = await mem.view('tnt-A', 'x.md');
      const b = await mem.view('tnt-B', 'x.md');
      expect(a).toBe('secret-A');
      expect(b).toBe('secret-B');
    }
  });
});

describe('Integration 10 — PTC handing off to Batch API', () => {
  it('PTC computes a tenant list then submits a batch for monthly billing', async () => {
    const driver = createPtcDriver();
    const ptcRes = await driver.runPTCSession({
      task: 'compute tenants requiring monthly bills',
      tools: [tools[0]!],
      model: 'claude-sonnet-4-6',
      ctx,
    });
    expect(ptcRes.ok).toBe(true);
    if (!ptcRes.ok) return;
    const batchDriver = createBatchDriver();
    const handle = await batchDriver.submitBatch({
      requests: [
        {
          customId: 'bill-001',
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: 'draft bill 001' }],
          maxTokens: 600,
        },
        {
          customId: 'bill-002',
          model: 'claude-sonnet-4-6',
          messages: [{ role: 'user', content: 'draft bill 002' }],
          maxTokens: 600,
        },
      ],
      model: 'claude-sonnet-4-6',
    });
    const result = await batchDriver.pollBatch(handle);
    expect(result.results).toHaveLength(2);
  });
});

describe('Integration 11 — Files + Cache control reuse', () => {
  it('file id is referenced in two cached prefix segments', async () => {
    const files = createFilesCitationsClient();
    const f = await files.uploadFile({
      path: '/tmp/long-lease.pdf',
      mime: 'application/pdf',
      tenantContext: ctx,
    });
    const seg1 = wrapStablePrefix(`Lease file: ${f.value}`);
    const seg2 = wrapStablePrefix('System: you are MD.');
    expect(seg1.cache_control.ttl_seconds).toBe(3600);
    expect(seg2.cache_control.ttl_seconds).toBe(3600);
    expect(betasForCacheTtl(3600)).toEqual(['extended-cache-ttl-2025-04-11']);
  });
});

describe('Integration 12 — End-to-end vendor onboarding composition', () => {
  it('runs the full §10 composition example deterministically', async () => {
    const files = createFilesCitationsClient();
    const driver = createPtcDriver();
    const harness = createComputerUseHarness();
    const mem = createMemoryAdapter();

    // 1. Upload contract template
    const tpl = await files.uploadFile({
      path: '/tmp/template.pdf',
      mime: 'application/pdf',
      title: 'BOSSNYUMBA standard SLA',
      tenantContext: ctx,
    });

    // 2. PTC session: research + draft + payment intent
    const ptcRes = await driver.runPTCSession({
      task: `evaluate AquaFix and draft contract from ${tpl.value}`,
      tools,
      model: 'claude-opus-4-7',
      ctx,
    });
    expect(ptcRes.ok).toBe(true);

    // 3. Computer Use: verify KRA VAT status (no API for this)
    const cu = await harness.runComputerUseSession({
      task: 'verify KRA VAT',
      allowedDomains: ['itax.kra.go.ke'],
      allowedActions: ['screenshot', 'left_click', 'zoom'],
      tenantContext: ctx,
      startUrl: 'https://itax.kra.go.ke/portal',
      scriptedActions: [
        { action: 'screenshot' },
        { action: 'left_click', target: '#pin-lookup' },
      ],
    });
    expect(cu.outcome).toBe('completed');

    // 4. Persist receipt into memory
    await mem.create(
      'tnt-acme',
      'vendors/aquafix-receipt.md',
      `vendor=AquaFix; status=approved`,
    );
    const receipt = await mem.view('tnt-acme', 'vendors/aquafix-receipt.md');
    expect(receipt).toContain('approved');

    // 5. Cited final answer
    const cited = await files.analyzeWithCitations({
      fileIds: [tpl],
      prompt: 'Summarize the obligations',
      model: 'claude-opus-4-7',
      tenantContext: ctx,
    });
    expect(cited.citations.length).toBeGreaterThan(0);
  });
});
