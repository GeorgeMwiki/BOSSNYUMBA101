/**
 * Provider-internal helpers — kept package-private (not re-exported from
 * `index.ts`). Pure functions, no I/O.
 */

import { createHash } from 'node:crypto';

/**
 * SHA-256 hex (first 16 chars) of an input — used by stub providers to
 * synthesize deterministic placeholder URLs. Real provider implementations
 * may reuse this for the C2PA `instanceId` of inputs.
 */
export function deterministicHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
