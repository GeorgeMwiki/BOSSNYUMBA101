/**
 * @bossnyumba/module-templates — Ten platform-built-in module templates
 * registered as a single immutable bundle list. The orchestrator's
 * boot routine reads `ALL_TEMPLATE_BUNDLES` and UPSERTs each into the
 * `module_templates` + `module_accept_handlers` tables.
 *
 * One template (ESTATE) ships a fully-wired `create_lease_application`
 * handler. The other nine register handler stubs; their wiring lands
 * in later waves (24+).
 */

export type {
  ModuleTemplateBundle,
  AcceptHandlerDescriptor,
} from './types.js';

import type { ModuleTemplateBundle } from './types.js';
import { estateBundle } from './templates/estate/index.js';
import { hrBundle } from './templates/hr/index.js';
import { fleetBundle } from './templates/fleet/index.js';
import { procurementBundle } from './templates/procurement/index.js';
import { legalBundle } from './templates/legal/index.js';
import { financeBundle } from './templates/finance/index.js';
import { strategyBundle } from './templates/strategy/index.js';
import { complianceBundle } from './templates/compliance/index.js';
import { crmBundle } from './templates/crm/index.js';
import { inventoryBundle } from './templates/inventory/index.js';

export {
  estateBundle,
  hrBundle,
  fleetBundle,
  procurementBundle,
  legalBundle,
  financeBundle,
  strategyBundle,
  complianceBundle,
  crmBundle,
  inventoryBundle,
};

export const ALL_TEMPLATE_BUNDLES: ReadonlyArray<ModuleTemplateBundle> =
  Object.freeze([
    estateBundle,
    hrBundle,
    fleetBundle,
    procurementBundle,
    legalBundle,
    financeBundle,
    strategyBundle,
    complianceBundle,
    crmBundle,
    inventoryBundle,
  ]);

/**
 * Look up a bundle by slug. Returns undefined when the slug is unknown.
 */
export function findBundle(
  slug: string,
): ModuleTemplateBundle | undefined {
  return ALL_TEMPLATE_BUNDLES.find((b) => b.slug === slug);
}

// Re-export ESTATE handler symbols so the executor can import the live
// implementation directly during Wave 22 development.
export {
  createLeaseApplicationHandler,
  CreateLeaseApplicationPayloadSchema,
  type CreateLeaseApplicationPayload,
  type CreateLeaseApplicationDeps,
  type CreateLeaseApplicationContext,
  type CreateLeaseApplicationResult,
} from './templates/estate/index.js';
