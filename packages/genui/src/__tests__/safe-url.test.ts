/**
 * Regression test for the shared href guard (H41/H42 + same-class siblings).
 *
 * safeUrl() is the ONE chokepoint every data-driven href in the package routes
 * through (MarkdownCard citations, DecisionTrace evidence, EvidenceCard,
 * FilePreview, PdfViewer). A model/data-authored `javascript:` / `data:` /
 * `vbscript:` URL passes schema validation but must NEVER reach an <a href>.
 * If this test regresses, a stored-XSS hole has reopened across all five
 * components at once.
 */

/* eslint-disable no-script-url -- this suite MUST contain javascript:/vbscript: URLs to prove safeUrl() rejects them */
import { describe, it, expect } from 'vitest';

import { safeUrl } from '../safe-url';

describe('safeUrl — the shared href XSS guard', () => {
  it('allows http(s), mailto, tel, and same-document relative refs', () => {
    expect(safeUrl('https://example.com/x')).toBe('https://example.com/x');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeUrl('tel:+255700000000')).toBe('tel:+255700000000');
    expect(safeUrl('/owner/leases')).toBe('/owner/leases');
    expect(safeUrl('#cite-1')).toBe('#cite-1');
    expect(safeUrl('./relative')).toBe('./relative');
  });

  it('rejects javascript:, data:, vbscript: — including case and whitespace evasion', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBeUndefined();
    expect(safeUrl('  javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('java\tscript:alert(1)')).toBeUndefined();
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeUrl('vbscript:msgbox(1)')).toBeUndefined();
  });

  it('rejects empty / nullish / bare-host inputs (omit the href, render a label)', () => {
    expect(safeUrl(undefined)).toBeUndefined();
    expect(safeUrl(null)).toBeUndefined();
    expect(safeUrl('')).toBeUndefined();
    expect(safeUrl('   ')).toBeUndefined();
    // A scheme-less bare host is ambiguous — omit rather than guess.
    expect(safeUrl('example.com/x')).toBeUndefined();
  });
});
