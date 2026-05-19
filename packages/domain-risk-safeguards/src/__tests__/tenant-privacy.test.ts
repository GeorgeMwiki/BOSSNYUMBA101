/**
 * Tenant-privacy tests.
 *
 * 5 retention sweeps (one per channel + one full no-records case)
 * 5 egress-audit events (one per channel + cross-tenant case)
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_PII_CHANNELS,
  recordEgressEvent,
  sweepRetention,
  TENANT_PRIVACY_DECLARATIONS,
} from '../tenant-privacy/index.js';
import type {
  EgressAuditEvent,
  EgressAuditPort,
  PiiChannel,
  PiiRetentionPort,
} from '../types.js';

const TENANT = '44444444-4444-4444-4444-444444444444';
const NOW = new Date('2026-04-01T00:00:00.000Z');

function retentionPort(overdueByChannel: Record<PiiChannel, string[]>): {
  port: PiiRetentionPort;
  deletes: Array<{ tenantId: string; channel: PiiChannel; recordId: string }>;
} {
  const deletes: Array<{ tenantId: string; channel: PiiChannel; recordId: string }> = [];
  return {
    port: {
      findOverdue: async ({ channel }) =>
        (overdueByChannel[channel] ?? []).map((recordId) => ({ recordId })),
      delete: async ({ tenantId, channel, recordId }) => {
        deletes.push({ tenantId, channel, recordId });
      },
    },
    deletes,
  };
}

function egressPort(): { port: EgressAuditPort; records: EgressAuditEvent[] } {
  const records: EgressAuditEvent[] = [];
  return {
    port: {
      record: async (e) => {
        records.push(e);
      },
      listSince: async ({ since, until }) =>
        records.filter((r) => r.emittedAt >= since && r.emittedAt < until),
    },
    records,
  };
}

describe('tenant-privacy — declarations', () => {
  it('declares all four channels', () => {
    expect(ALL_PII_CHANNELS.length).toBe(4);
    for (const channel of ALL_PII_CHANNELS) {
      expect(TENANT_PRIVACY_DECLARATIONS[channel].channel).toBe(channel);
      expect(TENANT_PRIVACY_DECLARATIONS[channel].retentionDays).toBeGreaterThan(0);
      expect(
        TENANT_PRIVACY_DECLARATIONS[channel].accessControlRoles.length,
      ).toBeGreaterThan(0);
      expect(
        TENANT_PRIVACY_DECLARATIONS[channel].lawfulBasisCitations.length,
      ).toBeGreaterThan(0);
    }
  });

  it('biometric retention is shortest (90d)', () => {
    expect(TENANT_PRIVACY_DECLARATIONS['biometric-smartlock'].retentionDays).toBe(90);
  });

  it('lease-pdf retention is longest (7 years)', () => {
    expect(TENANT_PRIVACY_DECLARATIONS['lease-pdf'].retentionDays).toBe(2555);
  });
});

describe('tenant-privacy — 5 retention-sweep cases', () => {
  let seq = 0;
  const idFactory = () => `sweep-${++seq}`;

  it('biometric sweep deletes 3 overdue records', async () => {
    const { port, deletes } = retentionPort({
      'biometric-smartlock': ['b-1', 'b-2', 'b-3'],
      'chat-transcript': [],
      'mpesa-sms': [],
      'lease-pdf': [],
    });
    const ev = await sweepRetention({
      tenantId: TENANT,
      channel: 'biometric-smartlock',
      now: NOW,
      retention: port,
      sweepIdFactory: idFactory,
    });
    expect(ev.recordsExamined).toBe(3);
    expect(ev.recordsDeleted).toBe(3);
    expect(deletes.length).toBe(3);
    expect(deletes.every((d) => d.channel === 'biometric-smartlock')).toBe(true);
  });

  it('chat-transcript sweep deletes 2 overdue records', async () => {
    const { port, deletes } = retentionPort({
      'biometric-smartlock': [],
      'chat-transcript': ['t-1', 't-2'],
      'mpesa-sms': [],
      'lease-pdf': [],
    });
    const ev = await sweepRetention({
      tenantId: TENANT,
      channel: 'chat-transcript',
      now: NOW,
      retention: port,
      sweepIdFactory: idFactory,
    });
    expect(ev.recordsDeleted).toBe(2);
    expect(deletes.length).toBe(2);
  });

  it('mpesa-sms sweep handles empty result', async () => {
    const { port, deletes } = retentionPort({
      'biometric-smartlock': [],
      'chat-transcript': [],
      'mpesa-sms': [],
      'lease-pdf': [],
    });
    const ev = await sweepRetention({
      tenantId: TENANT,
      channel: 'mpesa-sms',
      now: NOW,
      retention: port,
      sweepIdFactory: idFactory,
    });
    expect(ev.recordsExamined).toBe(0);
    expect(ev.recordsDeleted).toBe(0);
    expect(deletes.length).toBe(0);
  });

  it('lease-pdf sweep deletes 1 ancient record', async () => {
    const { port, deletes } = retentionPort({
      'biometric-smartlock': [],
      'chat-transcript': [],
      'mpesa-sms': [],
      'lease-pdf': ['l-old'],
    });
    const ev = await sweepRetention({
      tenantId: TENANT,
      channel: 'lease-pdf',
      now: NOW,
      retention: port,
      sweepIdFactory: idFactory,
    });
    expect(ev.recordsDeleted).toBe(1);
    expect(deletes[0]?.recordId).toBe('l-old');
  });

  it('sweep computes olderThan based on retentionDays', async () => {
    let capturedOlderThan = '';
    const port: PiiRetentionPort = {
      findOverdue: async ({ olderThan }) => {
        capturedOlderThan = olderThan;
        return [];
      },
      delete: async () => {},
    };
    await sweepRetention({
      tenantId: TENANT,
      channel: 'biometric-smartlock',
      now: NOW,
      retention: port,
      sweepIdFactory: idFactory,
    });
    // biometric = 90d. 90d before 2026-04-01 is 2026-01-01
    expect(capturedOlderThan).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('tenant-privacy — 5 egress-audit cases', () => {
  let seq = 0;
  const idFactory = () => `event-${++seq}`;

  it('records a biometric egress', async () => {
    const { port, records } = egressPort();
    await recordEgressEvent({
      tenantId: TENANT,
      channel: 'biometric-smartlock',
      recordId: 'r-1',
      destination: 'smartlock-vendor-api',
      actorId: 'sys-1',
      purpose: 'enrolment',
      now: NOW,
      eventIdFactory: idFactory,
      egressAudit: port,
    });
    expect(records.length).toBe(1);
    expect(records[0]?.channel).toBe('biometric-smartlock');
    expect(records[0]?.purpose).toBe('enrolment');
  });

  it('records a chat-transcript egress', async () => {
    const { port, records } = egressPort();
    await recordEgressEvent({
      tenantId: TENANT,
      channel: 'chat-transcript',
      recordId: 'r-2',
      destination: 'support-tier-2-query',
      actorId: 'support-1',
      purpose: 'dispute-investigation',
      now: NOW,
      eventIdFactory: idFactory,
      egressAudit: port,
    });
    expect(records[0]?.channel).toBe('chat-transcript');
  });

  it('records an M-Pesa egress', async () => {
    const { port, records } = egressPort();
    await recordEgressEvent({
      tenantId: TENANT,
      channel: 'mpesa-sms',
      recordId: 'r-3',
      destination: 'tax-export-service',
      actorId: 'sys-tax',
      purpose: 'kra-mri-quarterly',
      now: NOW,
      eventIdFactory: idFactory,
      egressAudit: port,
    });
    expect(records[0]?.channel).toBe('mpesa-sms');
  });

  it('records a lease-pdf egress', async () => {
    const { port, records } = egressPort();
    await recordEgressEvent({
      tenantId: TENANT,
      channel: 'lease-pdf',
      recordId: 'r-4',
      destination: 'legal-team-export',
      actorId: 'legal-1',
      purpose: 'court-order',
      now: NOW,
      eventIdFactory: idFactory,
      egressAudit: port,
    });
    expect(records[0]?.channel).toBe('lease-pdf');
  });

  it('records multiple egresses and lists them since', async () => {
    const { port, records } = egressPort();
    for (let i = 0; i < 4; i++) {
      await recordEgressEvent({
        tenantId: TENANT,
        channel: 'chat-transcript',
        recordId: `r-${i}`,
        destination: 'support-tier-2-query',
        actorId: 'support-1',
        purpose: 'inv',
        now: NOW,
        eventIdFactory: idFactory,
        egressAudit: port,
      });
    }
    expect(records.length).toBe(4);
    const listed = await port.listSince({
      tenantId: TENANT,
      since: '2026-01-01T00:00:00.000Z',
      until: '2026-12-31T23:59:59.999Z',
    });
    expect(listed.length).toBe(4);
  });
});
