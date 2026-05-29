/**
 * Composer + multi-format renderer integration tests.
 *
 * Wave UNIVERSAL-DOC-DRAFTER. Each format must emit the right
 * content-type and a non-empty buffer. The composer must produce a
 * bilingual concatenation when language='bilingual'.
 */

import { describe, expect, it } from 'vitest';

import { composeDraft, renderComposedDraft } from '../index.js';
import type { BrandContext } from '../brand.js';

const brand: BrandContext = {
  tenantName: 'Test Estate',
  title: 'Test Document',
  auditHashTail: 'abcd1234',
  classification: 'internal',
  author: 'Mr. Mwikila',
  renderedAtUtc: '2026-05-29T10:00:00Z',
};

const leaseVars = {
  landlordName: 'Estate Co',
  landlordAddress: 'Box 1, Dar',
  tenantName: 'Tenant X',
  premisesAddress: 'Bahari Heights',
  unitDescriptor: 'Apt 1A',
  termMonths: 12,
  startDate: '2026-07-01',
  monthlyRentAmount: 500000,
  currencyCode: 'TZS',
};

describe('composeDraft', () => {
  it('produces a single-language compose result for language=en', async () => {
    const r = await composeDraft({
      templateId: 'lease-agreement',
      language: 'en',
      fillVars: leaseVars,
    });
    expect(r.isBilingualMerge).toBe(false);
    expect(r.contentMd).toContain('RESIDENTIAL LEASE');
  });

  it('produces a bilingual compose result when language=bilingual', async () => {
    const r = await composeDraft({
      templateId: 'lease-agreement',
      language: 'bilingual',
      fillVars: leaseVars,
    });
    expect(r.isBilingualMerge).toBe(true);
    expect(r.contentMd).toContain('MKATABA WA KUPANGA NYUMBA');
    expect(r.contentMd).toContain('RESIDENTIAL LEASE');
    // Divider between sw and en blocks
    expect(r.contentMd).toContain('\n\n---\n\n');
  });

  it('throws on unknown template id', async () => {
    await expect(
      composeDraft({
        templateId: 'does-not-exist',
        language: 'en',
        fillVars: {},
      }),
    ).rejects.toThrow(/unknown template/);
  });
});

describe('renderComposedDraft', () => {
  it('renders markdown with branding header + footer', async () => {
    const composed = await composeDraft({
      templateId: 'memo-internal',
      language: 'en',
      fillVars: {
        to: 'Team',
        from: 'CEO',
        subject: 'Test',
        body: 'Test body.',
      },
    });
    const r = await renderComposedDraft(composed, 'md', brand);
    const text = r.body.toString('utf8');
    expect(r.contentType).toMatch(/markdown/);
    expect(text).toContain('BossNyumba');
    expect(text).toContain('Test Document');
    expect(text).toContain('audit:abcd1234');
  });

  it('renders HTML with bossnyumba CSS classes', async () => {
    const composed = await composeDraft({
      templateId: 'memo-internal',
      language: 'en',
      fillVars: {
        to: 'Team',
        from: 'CEO',
        subject: 'Test',
        body: 'Test body.',
      },
    });
    const r = await renderComposedDraft(composed, 'html', brand);
    const text = r.body.toString('utf8');
    expect(r.contentType).toMatch(/text\/html/);
    expect(text).toContain('<!DOCTYPE html>');
    expect(text).toContain('bossnyumba-header');
    expect(text).toContain('bossnyumba-doc');
    expect(text).toContain('bossnyumba-footer');
  });

  it('renders DOCX with the OOXML content-type', async () => {
    const composed = await composeDraft({
      templateId: 'memo-internal',
      language: 'en',
      fillVars: {
        to: 'Team',
        from: 'CEO',
        subject: 'Test',
        body: 'Test body.',
      },
    });
    const r = await renderComposedDraft(composed, 'docx', brand);
    expect(r.contentType).toMatch(/wordprocessingml/);
    expect(r.body.length).toBeGreaterThan(0);
    // ZIP magic bytes "PK"
    expect(r.body[0]).toBe(0x50);
    expect(r.body[1]).toBe(0x4b);
  });

  it('renders PPTX with the OOXML content-type', async () => {
    const composed = await composeDraft({
      templateId: 'board-resolution',
      language: 'en',
      fillVars: {
        companyName: 'BC Ltd',
        resolutionNumber: 'BR-01',
        meetingDate: '2026-05-29',
        resolutionTitle: 'Test',
        whereasClauses: ['One thing.'],
        resolvedClauses: ['Do it.'],
        directors: [{ name: 'A', role: 'CEO' }],
      },
    });
    const r = await renderComposedDraft(composed, 'pptx', brand);
    expect(r.contentType).toMatch(/presentationml/);
    expect(r.body.length).toBeGreaterThan(0);
    // ZIP magic bytes
    expect(r.body[0]).toBe(0x50);
    expect(r.body[1]).toBe(0x4b);
  });

  it('PDF path returns a buffer (real PDF or pdf.html fallback)', async () => {
    const composed = await composeDraft({
      templateId: 'memo-internal',
      language: 'en',
      fillVars: {
        to: 'Team',
        from: 'CEO',
        subject: 'Test',
        body: 'Test body.',
      },
    });
    const r = await renderComposedDraft(composed, 'pdf', brand);
    expect(r.body.length).toBeGreaterThan(0);
    // Either real PDF (`%PDF-`) or html fallback.
    expect(['pdf', 'pdf.html']).toContain(r.extension);
  });
});

describe('renderer richness counters', () => {
  it('reports zero counters on a plain memo', async () => {
    const composed = await composeDraft({
      templateId: 'memo-internal',
      language: 'en',
      fillVars: {
        to: 'A',
        from: 'B',
        subject: 'C',
        body: 'No special blocks.',
      },
    });
    const r = await renderComposedDraft(composed, 'html', brand);
    expect(r.richness).toBeDefined();
    expect(r.richness?.mermaidCount).toBe(0);
    expect(r.richness?.mathCount).toBe(0);
    expect(r.richness?.citationCount).toBe(0);
  });
});
