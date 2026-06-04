/**
 * Privacy-router core tests. Deterministic stubs for the PII and local-health
 * ports; fixed clock for stable audit timestamps.
 */

import { describe, expect, it } from 'vitest';
import {
  createInMemoryAuditStore,
  createPrivacyRouter,
  type LocalEndpointHealthPort,
  type PiiStripperPort,
  type PrivacyClock,
  type PrivacyRouterDeps,
  type StripResult,
} from './index.js';

const FIXED = new Date('2026-06-04T12:00:00.000Z');
const fixedClock: PrivacyClock = { now: () => FIXED };

/** Strips the literal substring "NIDA" and any known-name token. */
function makePii(containsPiiResult: boolean): PiiStripperPort {
  return {
    containsPii: () => containsPiiResult,
    stripPii: (text, knownNames): StripResult => {
      const mappings: Record<string, string> = {};
      let stripped = text;
      if (text.includes('NIDA')) {
        mappings['[NIDA_0]'] = 'NIDA';
        stripped = stripped.replaceAll('NIDA', '[NIDA_0]');
      }
      for (const name of knownNames ?? []) {
        if (stripped.includes(name)) {
          const token = `[NAME_${Object.keys(mappings).length}]`;
          mappings[token] = name;
          stripped = stripped.replaceAll(name, token);
        }
      }
      return { stripped, mappings };
    },
  };
}

const healthy: LocalEndpointHealthPort = { isHealthy: async () => true };
const unhealthy: LocalEndpointHealthPort = { isHealthy: async () => false };
const throwingHealth: LocalEndpointHealthPort = {
  isHealthy: async () => {
    throw new Error('ollama unreachable');
  },
};

function baseDeps(over: Partial<PrivacyRouterDeps> = {}): PrivacyRouterDeps {
  return {
    pii: makePii(false),
    localHealth: healthy,
    clock: fixedClock,
    ...over,
  };
}

describe('classification', () => {
  it('uses an explicit override above everything else', () => {
    const r = createPrivacyRouter(baseDeps());
    expect(
      r.classify({ text: 'hello', classificationOverride: 'RESTRICTED' }),
    ).toBe('RESTRICTED');
  });

  it('escalates a restricted field prefix to RESTRICTED', () => {
    const r = createPrivacyRouter(baseDeps());
    expect(r.classify({ text: 'x', fieldPaths: ['compliance.note'] })).toBe(
      'RESTRICTED',
    );
  });

  it('maps a CONFIDENTIAL task category', () => {
    const r = createPrivacyRouter(baseDeps());
    expect(r.classify({ text: 'x', taskCategory: 'rent_assessment' })).toBe(
      'CONFIDENTIAL',
    );
  });

  it('maps a PUBLIC task category when no PII present', () => {
    const r = createPrivacyRouter(baseDeps({ pii: makePii(false) }));
    expect(r.classify({ text: 'x', taskCategory: 'blog_generation' })).toBe(
      'PUBLIC',
    );
  });

  it('bumps a PUBLIC task to CONFIDENTIAL when PII is detected', () => {
    const r = createPrivacyRouter(baseDeps({ pii: makePii(true) }));
    expect(r.classify({ text: 'x', taskCategory: 'blog_generation' })).toBe(
      'CONFIDENTIAL',
    );
  });

  it('takes the most restrictive of field-prefix and task category', () => {
    const r = createPrivacyRouter(baseDeps());
    // PUBLIC task + RESTRICTED field => RESTRICTED.
    expect(
      r.classify({
        text: 'x',
        taskCategory: 'blog_generation',
        fieldPaths: ['sanctions.hit'],
      }),
    ).toBe('RESTRICTED');
  });

  it('honours an injected field classifier', () => {
    const r = createPrivacyRouter(
      baseDeps({ fieldClassifier: { classifyField: () => 'CONFIDENTIAL' } }),
    );
    expect(r.classify({ text: 'x', fieldPaths: ['some.field'] })).toBe(
      'CONFIDENTIAL',
    );
  });

  it('degrades safely to PUBLIC when the field classifier throws', () => {
    const r = createPrivacyRouter(
      baseDeps({
        fieldClassifier: {
          classifyField: () => {
            throw new Error('classifier boom');
          },
        },
      }),
    );
    // A throwing classifier must not crash; the prefix list still governs, so a
    // benign field path stays PUBLIC.
    expect(r.classify({ text: 'x', fieldPaths: ['some.field'] })).toBe(
      'PUBLIC',
    );
    // A restricted prefix still escalates even when the classifier throws.
    expect(r.classify({ text: 'x', fieldPaths: ['sanctions.hit'] })).toBe(
      'RESTRICTED',
    );
  });
});

describe('routing branches', () => {
  it('PUBLIC -> default cloud provider, no strip', async () => {
    const r = createPrivacyRouter(baseDeps());
    const res = await r.route({ text: 'hi', taskCategory: 'blog_generation' });
    expect(res.endpoint).toBe('claude');
    expect(res.piiStripped).toBe(false);
    expect(res.processedText).toBe('hi');
    expect(res.timestamp).toBe(FIXED.toISOString());
  });

  it('PUBLIC honours a preferred approved provider', async () => {
    const r = createPrivacyRouter(baseDeps());
    const res = await r.route({
      text: 'hi',
      taskCategory: 'blog_generation',
      preferredProvider: 'openai',
    });
    expect(res.endpoint).toBe('openai');
  });

  it('INTERNAL -> cloud, no strip', async () => {
    const r = createPrivacyRouter(baseDeps());
    const res = await r.route({ text: 'hi', taskCategory: 'platform_insight' });
    expect(res.endpoint).toBe('claude');
    expect(res.piiStripped).toBe(false);
    expect(res.classification).toBe('INTERNAL');
  });

  it('CONFIDENTIAL -> cloud with mandatory PII strip', async () => {
    const r = createPrivacyRouter(baseDeps());
    const res = await r.route({
      text: 'owner NIDA on file',
      taskCategory: 'rent_assessment',
    });
    expect(res.endpoint).toBe('claude');
    expect(res.piiStripped).toBe(true);
    expect(res.strippedFields).toContain('[NIDA_0]');
    expect(res.processedText).toBe('owner [NIDA_0] on file');
    expect(res.piiMappings?.['[NIDA_0]']).toBe('NIDA');
  });

  it('RESTRICTED + healthy local -> ollama with strip', async () => {
    const r = createPrivacyRouter(baseDeps({ localHealth: healthy }));
    const res = await r.route({
      text: 'NIDA leak',
      taskCategory: 'sanctions_screening',
    });
    expect(res.endpoint).toBe('ollama');
    expect(res.piiStripped).toBe(true);
    expect(res.processedText).toBe('[NIDA_0] leak');
  });

  it('RESTRICTED + unhealthy local -> DENIED (fail closed)', async () => {
    const r = createPrivacyRouter(baseDeps({ localHealth: unhealthy }));
    const res = await r.route({
      text: 'secret',
      taskCategory: 'compliance_investigation',
    });
    expect(res.endpoint).toBe('DENIED');
    expect(res.piiStripped).toBe(true);
    expect(res.reason).toMatch(/BOT Act/);
  });

  it('RESTRICTED + throwing local health -> DENIED (fail closed)', async () => {
    const r = createPrivacyRouter(baseDeps({ localHealth: throwingHealth }));
    const res = await r.route({
      text: 'secret',
      taskCategory: 'compliance_investigation',
    });
    // A thrown health check is treated as unhealthy: deny, never leak.
    expect(res.endpoint).toBe('DENIED');
    expect(res.piiStripped).toBe(true);
  });

  it('strips known names alongside detected PII', async () => {
    const r = createPrivacyRouter(baseDeps());
    const res = await r.route({
      text: 'Juma Mwakatobe NIDA',
      taskCategory: 'disbursement_narrative',
      knownNames: ['Juma Mwakatobe'],
    });
    expect(res.processedText).not.toContain('Juma Mwakatobe');
    // The raw NIDA token is replaced; both substitutions are recorded.
    expect(res.processedText).toBe('[NAME_1] [NIDA_0]');
    expect(Object.values(res.piiMappings ?? {})).toContain('NIDA');
    expect(Object.values(res.piiMappings ?? {})).toContain('Juma Mwakatobe');
  });
});

describe('isCloudAllowed', () => {
  it('blocks only RESTRICTED', () => {
    const r = createPrivacyRouter(baseDeps());
    expect(r.isCloudAllowed('RESTRICTED')).toBe(false);
    expect(r.isCloudAllowed('CONFIDENTIAL')).toBe(true);
    expect(r.isCloudAllowed('INTERNAL')).toBe(true);
    expect(r.isCloudAllowed('PUBLIC')).toBe(true);
  });
});

describe('audit log', () => {
  it('records every decision and reports stats', async () => {
    const r = createPrivacyRouter(baseDeps());
    await r.route({ text: 'a', taskCategory: 'blog_generation' });
    await r.route({ text: 'b', taskCategory: 'rent_assessment' });
    await r.route({
      text: 'c',
      taskCategory: 'compliance_investigation',
      classificationOverride: 'RESTRICTED',
    });

    const stats = await r.getAuditStats();
    expect(stats.total).toBe(3);
    expect(stats.byClassification.PUBLIC).toBe(1);
    expect(stats.byClassification.CONFIDENTIAL).toBe(1);
    expect(stats.byClassification.RESTRICTED).toBe(1);
    expect(stats.piiStrippedCount).toBe(2); // CONFIDENTIAL + RESTRICTED
    expect(stats.deniedCount).toBe(0);

    const log = await r.getAuditLog();
    expect(log).toHaveLength(3);
    // Most-recent first.
    expect(log[0]?.classification).toBe('RESTRICTED');
  });

  it('respects the ring-buffer capacity (drops oldest)', async () => {
    const r = createPrivacyRouter(
      baseDeps({ auditStore: createInMemoryAuditStore({ bufferSize: 2 }) }),
    );
    await r.route({ text: '1', taskCategory: 'blog_generation' });
    await r.route({ text: '2', taskCategory: 'platform_insight' });
    await r.route({ text: '3', taskCategory: 'rent_assessment' });
    const stats = await r.getAuditStats();
    expect(stats.total).toBe(2);
    // The PUBLIC (oldest) entry was dropped.
    expect(stats.byClassification.PUBLIC).toBe(0);
    expect(stats.byClassification.INTERNAL).toBe(1);
    expect(stats.byClassification.CONFIDENTIAL).toBe(1);
  });

  it('clears the audit log', async () => {
    const r = createPrivacyRouter(baseDeps());
    await r.route({ text: 'a', taskCategory: 'blog_generation' });
    await r.clearAuditLog();
    expect((await r.getAuditStats()).total).toBe(0);
  });

  it('forwards each decision to the optional audit sink (fire-and-forget)', async () => {
    const seen: string[] = [];
    const r = createPrivacyRouter(
      baseDeps({
        auditSink: {
          log: (entry) => {
            seen.push(entry.classification);
          },
        },
      }),
    );
    await r.route({ text: 'a', taskCategory: 'blog_generation' });
    await r.route({ text: 'b', taskCategory: 'rent_assessment' });
    expect(seen).toEqual(['PUBLIC', 'CONFIDENTIAL']);
  });

  it('survives a throwing audit sink without breaking routing', async () => {
    const r = createPrivacyRouter(
      baseDeps({
        auditSink: {
          log: () => {
            throw new Error('sink down');
          },
        },
      }),
    );
    const res = await r.route({ text: 'a', taskCategory: 'blog_generation' });
    expect(res.endpoint).toBe('claude');
    // The decision was still recorded in the durable store.
    expect((await r.getAuditStats()).total).toBe(1);
  });
});
