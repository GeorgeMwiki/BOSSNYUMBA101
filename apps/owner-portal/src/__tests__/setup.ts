/**
 * Vitest global setup for owner-portal.
 *
 * Pulls in `@testing-library/jest-dom/vitest` so component tests can
 * use matchers like `toBeInTheDocument()`. Matches the setup pattern
 * used in `packages/chat-ui/src/__tests__/setup.ts`.
 *
 * Also provides the small DOM globals jsdom omits but page-level
 * components rely on: `ResizeObserver` (recharts `ResponsiveContainer`
 * and other size-aware widgets construct one on mount). Without it,
 * mounting any chart-bearing page throws `ResizeObserver is not
 * defined` before a single assertion runs.
 */

import '@testing-library/jest-dom/vitest';

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom does not implement layout, so `Element.scrollIntoView` is absent.
// Chat/feed pages call it on a ref after messages load; without the stub the
// render throws before any assertion runs.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}
