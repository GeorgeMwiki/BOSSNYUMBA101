/**
 * Hardcoded-routes allow-list (Piece P).
 *
 * Frontend route paths should resolve through a `ROUTES` registry so
 * the URL layout can be changed in ONE place without sweeping the
 * codebase. A `router.push('/onboarding/welcome')` baked into a page
 * defeats that goal.
 *
 * Auto-allowlisted (NOT a violation):
 *   - Test / fixture / mock / story files.
 *   - The routes registry itself.
 *   - API-gateway route declarations (the Hono routes ARE the registry
 *     for the backend).
 *
 * Explicit allow-list:
 *   Files that legitimately reference literal frontend paths
 *   (auth-callbacks, error redirects). Every entry carries an
 *   ≥ 8-character justification.
 */

export const HARDCODED_ROUTES_ALLOWLIST = new Map([
  // ─── Frontend routes registry (the registry itself) ───────────────
  [
    'apps/customer-app/src/lib/routes.ts',
    'customer-app routes registry IS the canonical frontend route lookup table for the customer app.',
  ],
  [
    'apps/owner-portal/src/lib/routes.ts',
    'owner-portal routes registry IS the canonical frontend route lookup table for the owner portal.',
  ],
  [
    'apps/estate-manager-app/src/lib/routes.ts',
    'estate-manager-app routes registry IS the canonical frontend route lookup table for the estate manager app.',
  ],
  // ─── Admin platform portal (operator-only, no registry yet) ───────
  // The admin platform portal is an internal operator surface that does
  // not share the customer-app/owner-portal/estate-manager-app route
  // registry pattern. The single thread-create redirect below is the
  // only navigation call in this subtree that uses an inline path; it
  // is structurally tied to the /ask/[threadId] route convention.
  [
    'apps/admin-platform-portal/src/components/ask/AskChat.tsx',
    'admin platform portal — operator-only surface without its own ROUTES registry; thread-create redirect is structurally tied to the /ask/[threadId] convention.',
  ],
  // ─── Next.js app-router layouts: literal segment paths only ───────
  // (We allowlist the layout-level redirect helpers since they are
  // structurally tied to the Next.js routing model itself.)
]);
