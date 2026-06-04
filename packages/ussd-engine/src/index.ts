/**
 * @bossnyumba/ussd-engine — public API.
 *
 * Pure USSD menu-tree + session state machine for feature-phone tenants
 * (renters) and property owners. Wire it at the api-gateway composition root
 * with {@link wireUssdEngine} by injecting a session store, an identity
 * resolver, and the read-only data fetchers — then call `engine.handle(...)`
 * from the Africa's-Talking webhook route. The engine ships behind the
 * default-OFF flag {@link USSD_ENGINE_FLAG}.
 *
 * Ported and fully re-skinned to the BossNyumba real-estate domain. No direct
 * DB/SDK/env access — every side effect is an injected port.
 *
 * @module @bossnyumba/ussd-engine
 */

export * from './types';
export * from './ports';

export {
  buildMenuTree,
  buildMainMenu,
  buildLeaseScreen,
  buildNoLeaseScreen,
  buildRentScreen,
  buildNoRentScreen,
  buildMeterReadingPrompt,
  buildMeterReadingConfirm,
  buildMeterReadingLoggedScreen,
  buildMaintenanceScreen,
  buildNoMaintenanceScreen,
  buildMarketplaceScreen,
  buildLanguageMenu,
  buildLanguageSetScreen,
  buildErrorScreen,
  truncateToUssd,
  tierSatisfies,
  type UssdErrorCode,
} from './menu-tree';

export {
  handleUssdRequest,
  extractLatestInput,
  type UssdEngineDeps,
} from './session-machine';

export {
  createInMemorySessionStore,
  type InMemoryStoreOptions,
} from './in-memory-store';

export {
  wireUssdEngine,
  USSD_ENGINE_FLAG,
  type UssdEngine,
  type WireUssdEngineDeps,
} from './wire';
