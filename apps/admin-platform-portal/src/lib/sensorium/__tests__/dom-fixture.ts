/**
 * Test-only DOM fixture helper for the sensorium unit tests.
 *
 * Avoids `Element.innerHTML = '<html>'` in tests. Even when the fixture
 * is hardcoded (no untrusted input), setting innerHTML propagates the
 * pattern to anyone copy-pasting; using DocumentFragment + Range.createContextualFragment
 * keeps the same ergonomics while making the test set look like the
 * production code that AVOIDS innerHTML by default.
 *
 *   // before
 *   document.body.innerHTML = `<main><h1>HQ</h1></main>`;
 *
 *   // after
 *   setBodyFixture(`<main><h1>HQ</h1></main>`);
 *   clearBody();
 *
 * Underneath we still need to parse an HTML string (these tests want to
 * exercise the a11y-tree-snapshot helper against realistic DOM); the
 * difference is the *parse* happens in a dedicated helper that future
 * test authors are nudged to use, instead of every test reaching for
 * `.innerHTML` directly.
 */

/** Clear the document body without using innerHTML. */
export function clearBody(): void {
  document.body.replaceChildren();
}

/**
 * Mount the given HTML string under document.body, replacing any
 * existing content. The HTML is parsed via Range.createContextualFragment
 * (the same mechanism Range-based DOM APIs use internally) rather than
 * via `Element.innerHTML = …`.
 */
export function setBodyFixture(html: string): void {
  const range = document.createRange();
  range.selectNodeContents(document.body);
  const fragment = range.createContextualFragment(html);
  document.body.replaceChildren(fragment);
}

/**
 * Mount the given HTML string under an arbitrary element (replacing
 * existing children). Used in event-handler tests that need a sub-tree
 * rather than the whole body.
 */
export function setElementFixture(target: Element, html: string): void {
  const range = document.createRange();
  range.selectNodeContents(target);
  const fragment = range.createContextualFragment(html);
  target.replaceChildren(fragment);
}
