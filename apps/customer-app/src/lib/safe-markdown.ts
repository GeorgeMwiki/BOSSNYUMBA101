/**
 * Safe markdown renderer for customer-app blog posts.
 *
 * Closes round-3 finding C-1 (CRITICAL): the previous `renderMarkdownBasic`
 * fed user-authored bytes straight into `dangerouslySetInnerHTML` with no
 * HTML escaping. Any author (including a compromised staff account or an
 * LLM-assisted authoring flow) could plant `<script>`, `<img onerror>`,
 * `<iframe>`, or `<svg><animate onbegin>` payloads and exfiltrate the
 * customer auth bearer from localStorage.
 *
 * Strategy: HTML-escape every byte FIRST (so no raw markup survives),
 * THEN apply a minimal regex pass to wrap headers and paragraphs. The
 * regex now operates on escaped text — `<script>` becomes `&lt;script&gt;`
 * which is harmless when re-injected via `dangerouslySetInnerHTML`.
 *
 * A defence-in-depth `containsDangerousMarkup()` predicate is also
 * exported so the CMS / authoring API can reject malicious posts BEFORE
 * persisting them.
 */

/**
 * Escape the five HTML special characters. Sufficient because the
 * output is only used inside element content (not attributes, URLs,
 * or `<script>` blocks). For attribute or URL contexts use a real
 * sanitizer.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Detect any byte sequence an attacker would care to plant. Used by
 * the CMS write-side to reject posts before persistence — purely
 * additive belt-and-braces on top of the escape pipeline.
 */
export function containsDangerousMarkup(input: string): boolean {
  const patterns: readonly RegExp[] = [
    /<\s*script/i,
    /<\s*iframe/i,
    /<\s*object/i,
    /<\s*embed/i,
    /<\s*svg/i,
    /<\s*style/i,
    /\bon[a-z]+\s*=/i,
    /javascript\s*:/i,
    /data\s*:\s*text\s*\/\s*html/i,
  ];
  return patterns.some((p) => p.test(input));
}

/**
 * Render a markdown-ish body into safe HTML. Output is GUARANTEED to
 * contain no executable HTML — only the four wrapper tags this
 * function emits (`<h1>`, `<h2>`, `<p>`, and the implicit text nodes).
 *
 * The wrapper-tag whitelist is intentionally minimal. Adding new
 * formatting (lists, bold, links) MUST go through the same
 * escape-first → transform-second pipeline, or via a vetted markdown
 * library with HTML sanitization (markdown-it + DOMPurify).
 */
export function renderSafeMarkdown(md: string): string {
  // 1) Escape every byte first — strips any HTML the author included.
  const escaped = escapeHtml(md);

  // 2) Apply minimal markdown wrappers to the now-safe text.
  return escaped
    .replace(/^# (.*)$/gm, '<h1 class="text-3xl font-semibold mt-6">$1</h1>')
    .replace(/^## (.*)$/gm, '<h2 class="text-2xl font-semibold mt-6">$1</h2>')
    .replace(/\n\n/g, '</p><p class="my-3">')
    .replace(/^/, '<p class="my-3">')
    .replace(/$/, '</p>');
}
