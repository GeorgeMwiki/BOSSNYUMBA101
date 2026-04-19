/**
 * @bossnyumba/api-sdk — public entry.
 *
 * Re-exports:
 *   - `createBossnyumbaClient` and friends from `./client`
 *   - The OpenAPI-generated `paths`, `components`, `operations` types
 */

export {
  createBossnyumbaClient,
  ApiSdkError,
  buildUrl,
  parseErrorResponse,
  type BossnyumbaClient,
  type BossnyumbaClientConfig,
  type ApiSdkErrorPayload,
  type HttpMethod,
  type RequestArgs,
  type PathKeys,
} from './client.js';

export type { paths, components, operations, webhooks } from './types.js';
