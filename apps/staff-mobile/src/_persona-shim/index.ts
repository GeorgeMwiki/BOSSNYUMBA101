/**
 * Local persona-runtime shim — staff-mobile.
 *
 * Re-exports the BossNyumba-staff-specific persona surfaces that the
 * shared `@bossnyumba/persona-runtime` package does not yet ship. This
 * keeps the app off `@ts-nocheck` (forbidden by CLAUDE.md) and isolates
 * the mobile-only catalogue from the broader monorepo so sibling agents
 * can edit the shared package without colliding with mobile work.
 *
 * Files in this folder were copied from the Borjie source tree during
 * the May 2026 mobile port. Once the shared package adopts these
 * surfaces (post-mobile-port stabilisation) swap the imports back to
 * `from '@bossnyumba/persona-runtime'` and delete this folder.
 */

// Re-export everything that the shared package already provides — this
// way callers can replace `from '@bossnyumba/persona-runtime'` with
// `from '@/_persona-shim'` and get a strict superset.
export * from '@bossnyumba/persona-runtime'

// Borjie-only mobile extras (kept verbatim for now)
export * from './workforce-tab-catalog'
export * from './slash-commands'
export * from './ai-suggestion-chip'
export * from './output-style'
