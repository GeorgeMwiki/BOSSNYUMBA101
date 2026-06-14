/**
 * Vitest global setup for the marketing app.
 *
 * Pulls in `@testing-library/jest-dom/vitest` so component tests can use
 * matchers like `toBeInTheDocument()`. Matches the setup pattern used in
 * `apps/owner-portal/src/__tests__/setup.ts`.
 */

import '@testing-library/jest-dom/vitest';
