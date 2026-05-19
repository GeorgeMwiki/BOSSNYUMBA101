/**
 * Tenant-privacy threat-model enforcement — public exports.
 */

export {
  TENANT_PRIVACY_DECLARATIONS,
  ALL_PII_CHANNELS,
} from './declarations.js';
export { sweepRetention } from './retention-sweep.js';
export { recordEgressEvent } from './egress-audit.js';
