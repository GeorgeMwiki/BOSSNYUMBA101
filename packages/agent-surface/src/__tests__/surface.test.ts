/**
 * Surface adapter unit tests.
 *
 * Covers:
 *   - Same conversation across 3 surfaces (Web → WhatsApp → SMS)
 *   - Messages ordered correctly in unifiedTranscript
 *   - SMS-capable degrade for rich content (Matrix, chart-vega)
 *   - WhatsApp footnote rendering
 *   - Email HTML table rendering
 *   - Proactive surface picker
 */

import { describe, expect, it } from 'vitest';
import {
  EmailSurface,
  MobileSurface,
  SmsSurface,
  SURFACE_CAPABILITIES,
  WebSurface,
  WhatsAppSurface,
  canRenderNatively,
  createConversationStore,
  pickProactiveSurface,
  summariseRichPart,
} from '../surface/index.js';
import type { AgentTurn, ConversationTurn } from '../surface/index.js';

const baseTurn: AgentTurn = {
  turnId: 't-1',
  conversationId: 'conv-1',
  tenantId: 'tenant-A',
  principalId: 'p-A',
  createdAtIso: '2026-05-19T08:00:00.000Z',
  text: 'Your occupancy is 92% across 8 properties.',
  richParts: [
    {
      kind: 'matrix',
      title: 'My properties',
      rowCount: 8,
      columnCount: 3,
      rows: [],
      columns: [],
    },
    {
      kind: 'chart-vega',
      title: 'Occupancy trend',
      spec: {},
      data: [],
    },
  ],
  citations: [
    { id: 'c1', label: 'Westlands Apartments roll', sourceLocator: 'row 14' },
    { id: 'c2', label: 'Kilimani roll', sourceLocator: 'row 22' },
  ],
  attachments: [
    { url: 'https://x/y.png', mimeType: 'image/png', name: 'occupancy-chart.png' },
    { url: 'https://x/z.pdf', mimeType: 'application/pdf', name: 'report.pdf' },
  ],
};

describe('WebSurface', () => {
  it('renders rich parts natively + keeps citations + attachments', () => {
    const r = WebSurface.marshal(baseTurn);
    expect(r.surface).toBe('web');
    expect(r.text).toContain('92%');
    expect(r.richParts.length).toBe(2);
    expect(r.citations.length).toBe(2);
    expect(r.attachments.length).toBe(2);
  });
});

describe('MobileSurface', () => {
  it('is identical in shape to Web (rich + citations + attachments)', () => {
    const r = MobileSurface.marshal(baseTurn);
    expect(r.surface).toBe('mobile');
    expect(r.richParts.length).toBe(2);
    expect(r.attachments.length).toBe(2);
  });
});

describe('WhatsAppSurface', () => {
  it('degrades rich parts to inline summaries and appends a citation footnote', () => {
    const r = WhatsAppSurface.marshal(baseTurn);
    expect(r.surface).toBe('whatsapp');
    expect(r.body).toContain('92%');
    expect(r.body).toContain('My properties'); // matrix summary uses title
    expect(r.body).toContain('grid'); // matrix uses "grid"
    expect(r.body).toContain('chart'); // chart-vega summary
    expect(r.citationsFootnote).toContain('[1]');
    expect(r.citationsFootnote).toContain('[2]');
    expect(r.citationsFootnote).toContain('Westlands');
  });

  it('keeps only image attachments — drops PDFs', () => {
    const r = WhatsAppSurface.marshal(baseTurn);
    expect(r.imageAttachments.length).toBe(1);
    expect(r.imageAttachments[0]!.mimeType).toBe('image/png');
  });

  it('clamps body to 4096 chars max', () => {
    const longTurn: AgentTurn = { ...baseTurn, text: 'x'.repeat(10_000) };
    const r = WhatsAppSurface.marshal(longTurn);
    expect(r.body.length).toBeLessThanOrEqual(4096);
  });
});

describe('SmsSurface', () => {
  it('degrades rich parts to inline summaries — Matrix becomes one line', () => {
    const r = SmsSurface.marshal(baseTurn);
    expect(r.surface).toBe('sms');
    expect(r.body).toContain('92%');
    expect(r.body).toContain('My properties'); // matrix summary uses title
    expect(r.body).toContain('grid'); // matrix uses "grid"
    expect(r.body).toContain('Westlands'); // first citation only
  });

  it('hard-caps body to 1000 chars', () => {
    const longTurn: AgentTurn = { ...baseTurn, text: 'x'.repeat(2000) };
    const r = SmsSurface.marshal(longTurn);
    expect(r.body.length).toBeLessThanOrEqual(1000);
  });

  it('reports SMS parts count: 1 for short, >1 for long', () => {
    const shortTurn: AgentTurn = { ...baseTurn, text: 'short', richParts: [], citations: [] };
    expect(SmsSurface.marshal(shortTurn).parts).toBe(1);
    const longTurn: AgentTurn = {
      ...baseTurn,
      text: 'x'.repeat(900),
      richParts: [],
      citations: [],
    };
    expect(SmsSurface.marshal(longTurn).parts).toBeGreaterThan(1);
  });
});

describe('EmailSurface', () => {
  it('renders a subject line from the first text line', () => {
    const r = EmailSurface.marshal(baseTurn);
    expect(r.subject).toBe('Your occupancy is 92% across 8 properties.');
  });

  it('emits both html and plain bodies', () => {
    const r = EmailSurface.marshal(baseTurn);
    expect(r.htmlBody).toContain('<html>');
    expect(r.htmlBody).toContain('92%');
    expect(r.plainBody).toContain('92%');
    expect(r.plainBody).toContain('References:');
  });

  it('renders data-table natively as an HTML table', () => {
    const turn: AgentTurn = {
      ...baseTurn,
      richParts: [
        {
          kind: 'data-table',
          title: 'Rent due',
          columns: [
            { id: 'c1', header: 'Tenant', accessorKey: 'name' },
            { id: 'c2', header: 'Amount', accessorKey: 'amount' },
          ],
          rows: [
            { name: 'Alice', amount: '$1,000' },
            { name: 'Bob', amount: '$2,000' },
          ],
        },
      ],
    };
    const r = EmailSurface.marshal(turn);
    expect(r.htmlBody).toContain('<table');
    expect(r.htmlBody).toContain('Alice');
    expect(r.htmlBody).toContain('Bob');
  });

  it('escapes HTML in text body', () => {
    const turn: AgentTurn = {
      ...baseTurn,
      text: '<script>alert("xss")</script>',
      richParts: [],
      citations: [],
    };
    const r = EmailSurface.marshal(turn);
    expect(r.htmlBody).not.toContain('<script>');
    expect(r.htmlBody).toContain('&lt;script&gt;');
  });
});

describe('ConversationStore — cross-surface continuity', () => {
  it('same conversation continues across 3 surfaces with messages ordered correctly', () => {
    let store = createConversationStore();
    const turns: ConversationTurn[] = [
      {
        turnId: 't1',
        conversationId: 'conv-1',
        tenantId: 'tenant-A',
        principalId: 'p-A',
        surface: 'web',
        createdAtIso: '2026-05-19T08:00:00.000Z',
        role: 'user',
        text: 'show my occupancy',
      },
      {
        turnId: 't2',
        conversationId: 'conv-1',
        tenantId: 'tenant-A',
        principalId: 'p-A',
        surface: 'web',
        createdAtIso: '2026-05-19T08:00:01.000Z',
        role: 'agent',
        text: '92% across 8 properties',
      },
      {
        turnId: 't3',
        conversationId: 'conv-1',
        tenantId: 'tenant-A',
        principalId: 'p-A',
        surface: 'whatsapp',
        createdAtIso: '2026-05-19T12:00:00.000Z',
        role: 'user',
        text: 'who is behind on rent?',
      },
      {
        turnId: 't4',
        conversationId: 'conv-1',
        tenantId: 'tenant-A',
        principalId: 'p-A',
        surface: 'sms',
        createdAtIso: '2026-05-19T18:00:00.000Z',
        role: 'user',
        text: 'ok send notices',
      },
    ];
    for (const t of turns) store = store.appendTurn(t);

    const all = store.unifiedTranscript('conv-1');
    expect(all.length).toBe(4);
    expect(all.map((t) => t.turnId)).toEqual(['t1', 't2', 't3', 't4']);

    const surfaces = store.surfacesSeen('conv-1');
    expect(surfaces).toEqual(['web', 'whatsapp', 'sms']);
  });

  it('store is immutable — appending does not mutate prior snapshots', () => {
    const store0 = createConversationStore();
    const turn: ConversationTurn = {
      turnId: 't1',
      conversationId: 'c-1',
      tenantId: 't-A',
      principalId: 'p-A',
      surface: 'web',
      createdAtIso: '2026-01-01T00:00:00.000Z',
      role: 'user',
      text: 'hi',
    };
    const store1 = store0.appendTurn(turn);
    expect(store0.listTurns('c-1').length).toBe(0);
    expect(store1.listTurns('c-1').length).toBe(1);
  });

  it('unifiedTranscript sorts by createdAtIso even if appended out of order', () => {
    let store = createConversationStore();
    store = store.appendTurn({
      turnId: 'b',
      conversationId: 'c-1',
      tenantId: 't',
      principalId: 'p',
      surface: 'sms',
      createdAtIso: '2026-01-02',
      role: 'user',
      text: 'b',
    });
    store = store.appendTurn({
      turnId: 'a',
      conversationId: 'c-1',
      tenantId: 't',
      principalId: 'p',
      surface: 'web',
      createdAtIso: '2026-01-01',
      role: 'user',
      text: 'a',
    });
    const order = store.unifiedTranscript('c-1').map((t) => t.turnId);
    expect(order).toEqual(['a', 'b']);
  });
});

describe('pickProactiveSurface', () => {
  it('returns the lowest-priority enabled surface', () => {
    const pick = pickProactiveSurface({
      principalId: 'p-A',
      tenantId: 't-A',
      preferences: [
        { surface: 'email', priority: 3, enabled: true },
        { surface: 'whatsapp', priority: 1, enabled: true },
        { surface: 'sms', priority: 2, enabled: true },
      ],
    });
    expect(pick).toBe('whatsapp');
  });

  it('skips disabled surfaces', () => {
    const pick = pickProactiveSurface({
      principalId: 'p-A',
      tenantId: 't-A',
      preferences: [
        { surface: 'whatsapp', priority: 1, enabled: false },
        { surface: 'sms', priority: 2, enabled: true },
      ],
    });
    expect(pick).toBe('sms');
  });

  it('returns undefined when no consent supplied', () => {
    expect(pickProactiveSurface(undefined)).toBeUndefined();
  });

  it('returns undefined when all surfaces disabled', () => {
    expect(
      pickProactiveSurface({
        principalId: 'p',
        tenantId: 't',
        preferences: [{ surface: 'sms', priority: 1, enabled: false }],
      }),
    ).toBeUndefined();
  });
});

describe('degrade rules', () => {
  it('Vega chart degrades to text on SMS', () => {
    const out = summariseRichPart({
      kind: 'chart-vega',
      title: 'Trend',
      spec: {},
      data: [],
    });
    expect(out).toContain('[chart:');
    expect(out).toContain('Trend');
  });

  it('Matrix degrades to a "rowsxcols grid" line on SMS', () => {
    const out = summariseRichPart({
      kind: 'matrix',
      rowCount: 10,
      columnCount: 3,
      rows: [],
      columns: [],
      title: 'occupancy',
    });
    expect(out).toContain('10');
    expect(out).toContain('3');
    expect(out).toContain('occupancy');
  });

  it('data-table degrades to "[<title> table: N rows × M cols]" on SMS', () => {
    const out = summariseRichPart({
      kind: 'data-table',
      title: 'Rent due',
      columns: [{}, {}],
      rows: [{}, {}, {}],
    });
    expect(out).toContain('Rent due');
    expect(out).toContain('3 rows');
    expect(out).toContain('2 cols');
  });

  it('unknown rich kinds fall back to a generic placeholder', () => {
    const out = summariseRichPart({ kind: 'mystery-block' });
    expect(out).toContain('mystery-block');
  });

  it('canRenderNatively: web + mobile render anything; sms renders nothing', () => {
    const matrix = { kind: 'matrix' };
    expect(canRenderNatively('web', matrix)).toBe(true);
    expect(canRenderNatively('mobile', matrix)).toBe(true);
    expect(canRenderNatively('sms', matrix)).toBe(false);
  });

  it('email renders data-table and kpi-grid natively but not chart-vega', () => {
    expect(canRenderNatively('email', { kind: 'data-table' })).toBe(true);
    expect(canRenderNatively('email', { kind: 'kpi-grid' })).toBe(true);
    expect(canRenderNatively('email', { kind: 'chart-vega' })).toBe(false);
  });
});

describe('SURFACE_CAPABILITIES — surface table sanity', () => {
  it('web/mobile support richBlocks; whatsapp/sms do not', () => {
    expect(SURFACE_CAPABILITIES.web.richBlocks).toBe(true);
    expect(SURFACE_CAPABILITIES.mobile.richBlocks).toBe(true);
    expect(SURFACE_CAPABILITIES.whatsapp.richBlocks).toBe(false);
    expect(SURFACE_CAPABILITIES.sms.richBlocks).toBe(false);
  });

  it('SMS maxLengthChars is much less than email/web', () => {
    expect(SURFACE_CAPABILITIES.sms.maxLengthChars).toBeLessThan(
      SURFACE_CAPABILITIES.whatsapp.maxLengthChars,
    );
    expect(SURFACE_CAPABILITIES.sms.maxLengthChars).toBeLessThan(
      SURFACE_CAPABILITIES.web.maxLengthChars,
    );
  });
});
