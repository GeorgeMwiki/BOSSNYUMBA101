/**
 * @bossnyumba/tab-views/customization — view-preference persistence.
 */

export {
  createInMemoryCustomizationStore,
  buildPreferenceKey,
  type CustomizationStore,
  type InMemoryCustomizationStore,
  type ReadPreferenceArgs,
  type WritePreferenceArgs,
  type DeletePreferenceArgs,
  type ReadResolvedArgs,
} from './preference-store.js';

export {
  emptyPreference,
  applyEventToPreference,
} from './preference-derivation.js';
