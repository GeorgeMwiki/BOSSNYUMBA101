/**
 * Public surface for the seed registry. Portals import this module to
 * bootstrap a `SectionRegistry` pre-populated with the BossNyumba
 * real-estate seed sections.
 */

export {
  seedSections,
  seedSectionKeys,
  sectionSignalKeys,
  type SectionSignalKey,
} from './seed-sections.js';
export {
  ActiveLeasesSection,
  RentDueSoonSection,
  MaintenanceOpenSection,
  LeaseRenewalWindowSection,
  KraVatFilingSection,
  TraVatFilingSection,
  VacancyListingsSection,
  AccountantMonthEndSection,
  InternalStaffSection,
} from './section-components.js';

import { SectionRegistry } from '../registry/section-registry.js';
import { seedSections } from './seed-sections.js';

/**
 * Convenience factory: build a fresh registry pre-loaded with the
 * real-estate seed sections. Portals can chain `.register()` to add
 * their own portfolio-specific sections on top.
 */
export function createSeedRegistry(): SectionRegistry {
  return new SectionRegistry().registerAll(seedSections);
}
