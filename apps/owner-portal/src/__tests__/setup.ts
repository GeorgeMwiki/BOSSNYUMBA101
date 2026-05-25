/**
 * Vitest global setup for owner-portal.
 *
 * Pulls in `@testing-library/jest-dom/vitest` so component tests can
 * use matchers like `toBeInTheDocument()`. Matches the setup pattern
 * used in `packages/chat-ui/src/__tests__/setup.ts`.
 */

import '@testing-library/jest-dom/vitest';
