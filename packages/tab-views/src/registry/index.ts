/**
 * @bossnyumba/tab-views/registry — public surface.
 */

export {
  TabViewRegistry,
  createTabViewRegistry,
} from './tab-view-registry.js';

export {
  createSeedTabViewRegistry,
  HEADLINE_VIEWS,
  SEEDED_ENTITY_TYPES,
} from './seed.js';
export type { SeededEntityType } from './seed.js';

export { buildPlaceholderView } from './placeholder-view.js';
export type {
  PlaceholderQuery,
  PlaceholderRow,
  PlaceholderData,
} from './placeholder-view.js';
