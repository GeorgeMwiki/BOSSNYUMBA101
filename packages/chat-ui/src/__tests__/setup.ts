import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom implements no element scroll methods. The chat panels drive their
// streaming-scroll via useChatScroll (§5.1), which calls `el.scrollTo(...)` on
// render and on every streamed token, and read scrollTop/scrollHeight (jsdom
// returns 0 → "at bottom"). Stub both globally so any panel test can render
// without tripping the jsdom gap. (litfin-chat-panel.test.tsx historically
// stubbed scrollIntoView in-file; this hoists it to the shared setup.)
if (typeof Element.prototype.scrollTo !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Element.prototype.scrollTo = vi.fn();
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = vi.fn();
}
