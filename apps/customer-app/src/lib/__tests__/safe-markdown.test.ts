/**
 * Regression tests for round-3 finding C-1 (CRITICAL): Stored XSS via
 * blog markdown rendered without sanitization.
 *
 * Every XSS payload listed in `.audit/round3-frontend-apps-bug-sweep.md`
 * is exercised here. The output of `renderSafeMarkdown` MUST NOT contain
 * any executable HTML — only the four wrapper tags the renderer emits.
 */

import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  containsDangerousMarkup,
  renderSafeMarkdown,
} from '../safe-markdown';

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('escapes ampersand FIRST so subsequent escapes are not double-encoded', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});

describe('containsDangerousMarkup', () => {
  it.each([
    ['<script>alert(1)</script>'],
    ['<SCRIPT>alert(1)</SCRIPT>'],
    ['<img onerror="alert(1)" src="x">'],
    ['<svg><animate onbegin="alert(1)" /></svg>'],
    ['<iframe src="evil"></iframe>'],
    ['<a href="javascript:alert(1)">x</a>'],
    ['<a href="JaVaScRiPt:alert(1)">x</a>'],
    ['<style>body { background: url(evil) }</style>'],
    ['<embed src="evil">'],
    ['<object data="evil"></object>'],
    ['<a href="data:text/html,<script>alert(1)</script>">x</a>'],
  ])('rejects %s', (input) => {
    expect(containsDangerousMarkup(input)).toBe(true);
  });

  it('accepts benign markdown', () => {
    expect(containsDangerousMarkup('# Hello\n\nA normal paragraph.')).toBe(false);
    expect(containsDangerousMarkup('No HTML here at all.')).toBe(false);
  });
});

describe('renderSafeMarkdown — XSS regression', () => {
  it('escapes the literal <script>alert(document.cookie)</script> exploit', () => {
    const exploit = '<script>alert(document.cookie)</script>';
    const out = renderSafeMarkdown(exploit);
    // The exploit string must appear ESCAPED only — never as a live tag.
    expect(out).not.toContain('<script');
    expect(out).not.toContain('</script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('alert(document.cookie)');
  });

  it('escapes <img onerror> payloads', () => {
    const exploit = '<img src="x" onerror="alert(1)">';
    const out = renderSafeMarkdown(exploit);
    // No live tag survives.
    expect(out).not.toContain('<img');
    // The attribute quote MUST be escaped — without an unescaped
    // quote, `onerror=&quot;...&quot;` is plain text, not an
    // event handler.
    expect(out).not.toMatch(/onerror=["']/);
    expect(out).toContain('&lt;img');
    expect(out).toContain('&quot;');
  });

  it('escapes <svg><animate onbegin> SVG-based payloads', () => {
    const exploit = '<svg><animate onbegin="alert(1)" /></svg>';
    const out = renderSafeMarkdown(exploit);
    expect(out).not.toContain('<svg');
    expect(out).not.toContain('<animate');
    // Same rationale as the <img> case — only unescaped event
    // handlers can fire.
    expect(out).not.toMatch(/onbegin=["']/);
    expect(out).toContain('&lt;svg&gt;');
  });

  it('escapes <iframe> payloads', () => {
    const out = renderSafeMarkdown('<iframe src="https://evil"></iframe>');
    expect(out).not.toContain('<iframe');
    expect(out).toContain('&lt;iframe');
  });

  it('escapes <style> payloads', () => {
    const out = renderSafeMarkdown('<style>body{display:none}</style>');
    expect(out).not.toContain('<style');
    expect(out).toContain('&lt;style&gt;');
  });

  it('escapes javascript: URL payloads', () => {
    const out = renderSafeMarkdown('Click [here](javascript:alert(1))');
    // Even if we add link parsing later, the input is already escaped
    // so `javascript:` cannot become a live URL.
    expect(out).not.toContain('href="javascript:');
  });

  it('still wraps headers and paragraphs from clean input', () => {
    const out = renderSafeMarkdown('# Title\n\nA paragraph.');
    expect(out).toContain('<h1 class="text-3xl font-semibold mt-6">Title</h1>');
    expect(out).toContain('<p class="my-3">');
    expect(out).toContain('A paragraph.');
  });

  it('escapes & in plain text without breaking paragraph wrapping', () => {
    const out = renderSafeMarkdown('Tom & Jerry');
    expect(out).toContain('Tom &amp; Jerry');
    expect(out.startsWith('<p class="my-3">')).toBe(true);
    expect(out.endsWith('</p>')).toBe(true);
  });
});
