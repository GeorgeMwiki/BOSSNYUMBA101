/**
 * Anti-Scheming Dashboard — module barrel.
 */
export type {
  TenantSchemingSnapshot,
  PlatformSchemingSnapshot,
  CapabilityCardProps,
} from './types.js';
export type { TenantMetricInput } from './view-model.js';
export { toTenantSnapshot, toPlatformSnapshot, toCapabilityCard } from './view-model.js';
