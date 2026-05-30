/**
 * Staff-mobile user superpowers — v1 mobile port of the eight web
 * superpowers, scoped to the staff persona (maintenance worker /
 * estate manager field operator).
 *
 *  1. navigate    — long-press / SearchFab → ticket / unit / inspection
 *  2. prefill     — inspection / ticket form prefilled from active site
 *  3. highlight   — pulse on the ticket card referenced from chat
 *  4. share       — RN Share sheet for photo evidence / inspection PDF
 *  5. bulk        — multi-select on tickets → bulk close
 *  6. undo        — toast with 24h server-side window
 *  7. search-FAB  — universal search across tickets / units / docs
 *  8. bookmark    — pin a ticket / unit for the day's run
 */
export * from './bus'
export * from './navigate'
export * from './prefill'
export * from './highlight'
export * from './share'
export * from './bulk'
export * from './undo'
export * from './search'
export * from './bookmark'
export { SuperpowersBootstrap } from './SuperpowersBootstrap'
