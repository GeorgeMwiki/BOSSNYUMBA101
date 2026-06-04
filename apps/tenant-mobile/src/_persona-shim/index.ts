/**
 * Local persona-runtime shim — tenant-mobile.
 *
 * Re-exports the BossNyumba-tenant-specific persona surfaces that the
 * shared `@bossnyumba/persona-runtime` package does not yet ship. This
 * keeps the app off `@ts-nocheck` (forbidden by CLAUDE.md) and isolates
 * the mobile-only catalogue from the broader monorepo so sibling agents
 * can edit the shared package without colliding with mobile work.
 *
 * Files in this folder were copied from the upstream source tree during
 * the May 2026 mobile port. Once the shared package adopts these
 * surfaces (post-mobile-port stabilisation) swap the imports back to
 * `from '@bossnyumba/persona-runtime'` and delete this folder.
 */

export * from '@bossnyumba/persona-runtime'

export * from './workforce-tab-catalog'
export * from './slash-commands'
export * from './ai-suggestion-chip'
export * from './output-style'
