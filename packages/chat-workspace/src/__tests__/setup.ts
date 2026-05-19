import '@testing-library/jest-dom/vitest';

// jsdom doesn't ship scrollIntoView. Stub it so smooth-scroll calls
// don't throw under test.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op */
  };
}
