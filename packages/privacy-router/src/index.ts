/**
 * @bossnyumba/privacy-router — public surface.
 *
 * Sensitivity-tier AI routing for the BossNyumba real-estate operating system
 * (the brain layer, Mr. Mwikila, routes through this leaf). Routes an inference
 * request by the data-sensitivity tier of its payload to satisfy Tanzania BOT
 * Act / PDPA data-residency rules:
 *
 *   RESTRICTED   -> local model only, deny if unavailable
 *   CONFIDENTIAL -> approved cloud + mandatory PII strip
 *   INTERNAL     -> approved cloud, no strip
 *   PUBLIC       -> approved cloud, no restrictions
 *
 * Wire it at the api-gateway composition root with {@link wirePrivacyRouter} by
 * injecting a PII stripper, a local-endpoint health check, and (optionally) a
 * field classifier, an audit store, and a clock — then call
 * `facade.handle(request)`. The router ships behind the default-OFF flag
 * {@link PRIVACY_ROUTER_FLAG}.
 *
 * Pure wire-agnostic leaf: no direct DB / SDK / network / env access. Every
 * side effect is an injected port.
 *
 * @module @bossnyumba/privacy-router
 */

export {
  CLASSIFICATION_ORDER,
  privacyRoutingRequestSchema,
  auditLimitSchema,
  type DataClassification,
  type TaskCategory,
  type ApprovedCloudProvider,
  type LocalProvider,
  type PrivacyProvider,
  type RoutingEndpoint,
  type StripResult,
  type PrivacyRoutingRequest,
  type PrivacyRoutingResult,
  type PrivacyAuditEntry,
} from './types';

export {
  systemClock,
  type PiiStripperPort,
  type LocalEndpointHealthPort,
  type FieldClassifierPort,
  type AuditEntryStore,
  type PrivacyAuditSink,
  type PrivacyClock,
} from './ports';

export {
  DEFAULT_PRIVACY_POLICY,
  privacyPolicySchema,
  parsePrivacyPolicyYaml,
  type PrivacyPolicy,
} from './policy';

export {
  createPrivacyRouter,
  type PrivacyRouter,
  type PrivacyRouterDeps,
  type PrivacyAuditStats,
} from './router';

export {
  createInMemoryAuditStore,
  type InMemoryAuditStoreOptions,
} from './in-memory-store';

export {
  wirePrivacyRouter,
  PRIVACY_ROUTER_FLAG,
  type PrivacyRouterFacade,
  type WirePrivacyRouterDeps,
} from './wire';
