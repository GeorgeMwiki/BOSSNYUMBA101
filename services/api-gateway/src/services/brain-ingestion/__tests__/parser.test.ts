import { describe, expect, it } from 'vitest';
import { parseIncomingDoc } from '../parser.js';

describe('parseIncomingDoc - text inputs', () => {
  it('parses plain text and counts chars', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'note.txt', sourceKind: 'text', text: 'Hello tenant',
    });
    expect(out.text).toBe('Hello tenant');
    expect(out.extractedFacts.some((f) => f.kind === 'text.chars')).toBe(true);
    expect(out.detectedLanguage).toBe('en');
  });
  it('detects Swahili plain text via marker heuristic', async () => {
    const sw = 'Mpangaji wa nyumba ya kwanza atalipa kodi ya mwezi kwa wakati.';
    const out = await parseIncomingDoc({
      originalFilename: 'note.txt', sourceKind: 'text', text: sw.repeat(5),
    });
    expect(out.detectedLanguage).toBe('sw');
  });
  it('detects lease_agreement doc kind', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'lease.txt', sourceKind: 'text',
      text: 'This Lease Agreement is between the landlord and tenant',
    });
    expect(out.extractedFacts.find((f) => f.kind === 'realestate.doc_kind')?.value).toBe('lease_agreement');
  });
  it('detects condition_report doc kind', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'r.txt', sourceKind: 'text',
      text: 'Hali ya nyumba: rangi mpya, jiko jipya.',
    });
    expect(out.extractedFacts.find((f) => f.kind === 'realestate.doc_kind')?.value).toBe('condition_report');
  });
  it('detects eviction_notice doc kind', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'evict.txt', sourceKind: 'text',
      text: 'NOTICE TO QUIT: vacate the premises within 30 days.',
    });
    expect(out.extractedFacts.find((f) => f.kind === 'realestate.doc_kind')?.value).toBe('eviction_notice');
  });
  it('detects utility_bill doc kind', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'b.txt', sourceKind: 'text',
      text: 'Water bill for unit 4: TZS 25,000 due',
    });
    expect(out.extractedFacts.find((f) => f.kind === 'realestate.doc_kind')?.value).toBe('utility_bill');
  });
});

describe('parseIncomingDoc - csv table', () => {
  it('parses rent-roll CSV and detects realestate.table_kind=rent_roll', async () => {
    const csv = 'Unit,Tenant,Monthly Rent (TZS)\nA-101,Asha M.,500000\nA-102,Juma K.,450000\n';
    const out = await parseIncomingDoc({
      originalFilename: 'roll.csv', sourceKind: 'csv', text: csv,
    });
    expect(out.table?.headers).toEqual(['Unit', 'Tenant', 'Monthly Rent (TZS)']);
    expect(out.table?.rows).toHaveLength(2);
    expect(out.extractedFacts.find((f) => f.kind === 'realestate.table_kind')?.value).toBe('rent_roll');
  });
  it('parses utility register CSV', async () => {
    const csv = 'Meter ID,Water (m3),Period\nM1,30,2026-05\n';
    const out = await parseIncomingDoc({ originalFilename: 'water.csv', sourceKind: 'csv', text: csv });
    expect(out.extractedFacts.find((f) => f.kind === 'realestate.table_kind')?.value).toBe('utility_register');
  });
  it('parses payment-register CSV', async () => {
    const csv = 'Payer,Amount,Date\nAsha,500000,2026-05-01\n';
    const out = await parseIncomingDoc({ originalFilename: 'pay.csv', sourceKind: 'csv', text: csv });
    expect(out.extractedFacts.find((f) => f.kind === 'realestate.table_kind')?.value).toBe('payment_register');
  });
  it('does not flag a non-real-estate CSV', async () => {
    const csv = 'name,age\nAlice,33\n';
    const out = await parseIncomingDoc({ originalFilename: 'p.csv', sourceKind: 'csv', text: csv });
    expect(out.extractedFacts.find((f) => f.kind === 'realestate.table_kind')).toBeUndefined();
  });
});

describe('parseIncomingDoc - binary formats are graceful', () => {
  it('pdf returns a pending hint', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'lease.pdf', sourceKind: 'pdf', bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });
    expect(out.text).toContain('pdf upload accepted');
    expect(out.warnings).toContain('pdf_deep_extraction_pending');
  });
  it('photo returns vision-pending hint', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'r.jpg', sourceKind: 'photo', bytes: new Uint8Array([0xff, 0xd8, 0xff]),
    });
    expect(out.text).toContain('photo upload accepted');
    expect(out.warnings).toContain('photo_vision_pending');
  });
  it('audio returns stt-pending hint', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'r.wav', sourceKind: 'audio', bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]),
    });
    expect(out.text).toContain('audio upload accepted');
    expect(out.warnings).toContain('audio_stt_pending');
  });
});

describe('parseIncomingDoc - json + email + webpage', () => {
  it('parses json and lists top-level keys', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'app.json', sourceKind: 'json',
      text: JSON.stringify({ tenant: 'Asha', unit: 'A-101' }),
    });
    expect(out.extractedFacts.find((f) => f.kind === 'json.keys')?.value).toContain('tenant');
  });
  it('parses invalid json with a warning', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'bad.json', sourceKind: 'json', text: '{not valid',
    });
    expect(out.warnings.length).toBeGreaterThan(0);
  });
  it('parses email plain text', async () => {
    const out = await parseIncomingDoc({
      originalFilename: 'msg.eml', sourceKind: 'email',
      text: 'Hi landlord, please collect rent. Thanks.',
    });
    expect(out.text).toContain('landlord');
  });
});
