/**
 * LITFIN-port newly-ported packages — composition wiring (FRONT-B).
 *
 * Additively registers 9 freshly-ported leaf packages onto the
 * `ServiceRegistry` behind their own DEFAULT-OFF feature flags. Every
 * member of {@link LitfinPortBundle} is `null` unless an operator has
 * explicitly set the package's flag to `on` in the environment.
 *
 * Wired here (each ships a `wireXxx(deps)` facade + an `XXX_FLAG`
 * name constant; each returns `null` when `enabled` is false):
 *
 *   - `@bossnyumba/ussd-engine`             (BOSSNYUMBA_FEATURE_USSD_ENGINE)
 *   - `@bossnyumba/belief-engine`           (BOSSNYUMBA_FEATURE_BELIEF_ENGINE)
 *   - `@bossnyumba/learning-signal-emitter` (BOSSNYUMBA_FEATURE_LEARNING_SIGNAL_EMITTER)
 *   - `@bossnyumba/ledger-attestor`         (BOSSNYUMBA_FEATURE_LEDGER_ATTESTOR)
 *   - `@bossnyumba/channel-gateway`         (BOSSNYUMBA_FEATURE_CHANNEL_GATEWAY)
 *   - `@bossnyumba/document-reconciliation` (BOSSNYUMBA_FEATURE_DOCUMENT_RECONCILIATION)
 *   - `@bossnyumba/privacy-router`          (BOSSNYUMBA_FEATURE_PRIVACY_ROUTER)
 *   - `@bossnyumba/regulator-sim`           (BOSSNYUMBA_FEATURE_REGULATOR_SIM)
 *   - `@bossnyumba/blind-review`            (BOSSNYUMBA_FEATURE_BLIND_REVIEW)
 *
 * ## Env / config seam
 *
 * The flag value is resolved HERE — the composition layer — via
 * {@link readPortFlag}, mirroring the existing `resolveUncertaintyPolicyMode`
 * seam in `brain-kernel-wiring.ts`. Every ported package stays strictly
 * ENV-FREE: it never reads `process.env`. We compute `flag === 'on'` and
 * pass the resulting boolean to the package's `wireXxx({ enabled, ... })`.
 *
 * ## Default-OFF discipline
 *
 * For a package whose `wireXxx` deps include ports that have no shipped
 * in-memory default (USSD identity/data, channel signature/tier, privacy
 * pii/local-health, blind-review fetcher, ledger-attestor source/signer/
 * sinks), we build those deps ONLY inside the `on` branch — so the default
 * path constructs nothing at all. The deps we cannot resolve without a
 * concrete per-tenant adapter are filled with a `notWired*` stub that
 * throws a structured "not wired" error if actually invoked (mirroring
 * `buildPlaceholderSeedToolDeps` in `service-registry.ts`). Flipping a flag
 * `on` therefore mounts the facade with a clearly-signposted follow-up:
 * inject the real adapter via this wiring (a per-adapter follow-up, the
 * established pattern for every other LITFIN bundle).
 *
 * @module composition/litfin-port-wiring
 */

import {
  wireUssdEngine,
  USSD_ENGINE_FLAG,
  createInMemorySessionStore,
  type UssdEngine,
} from '@bossnyumba/ussd-engine';
import {
  wireBeliefEngine,
  BELIEF_ENGINE_FLAG,
  createInMemoryBeliefStore,
  type BeliefEngine,
} from '@bossnyumba/belief-engine';
import {
  wireLearningSignalEmitter,
  LEARNING_SIGNAL_EMITTER_FLAG,
  type LearningSignalEmitter,
} from '@bossnyumba/learning-signal-emitter';
import {
  wireLedgerAttestor,
  LEDGER_ATTESTOR_FLAG,
  type LedgerAttestor,
} from '@bossnyumba/ledger-attestor';
import {
  wireChannelGateway,
  CHANNEL_GATEWAY_FLAG,
  type ChannelGatewayFacade,
} from '@bossnyumba/channel-gateway';
import {
  wireDocumentReconciliation,
  DOCUMENT_RECONCILIATION_FLAG,
  type DocumentReconciliation,
} from '@bossnyumba/document-reconciliation';
import {
  wirePrivacyRouter,
  PRIVACY_ROUTER_FLAG,
  type PrivacyRouterFacade,
  type PiiStripperPort,
  type LocalEndpointHealthPort,
} from '@bossnyumba/privacy-router';
import {
  wireRegulatorSim,
  REGULATOR_SIM_FLAG,
  createInMemoryAuditStore as createRegulatorAuditStore,
  type RegulatorSim,
} from '@bossnyumba/regulator-sim';
import {
  wireBlindReview,
  BLIND_REVIEW_FLAG,
  createInMemoryBlindReviewStore,
  type BlindReview,
} from '@bossnyumba/blind-review';

import { logger } from '../utils/logger.js';

/**
 * Newly-ported packages exposed via DI. Each slot is `null` until its
 * DEFAULT-OFF flag is flipped `on`. Consumers (route handlers, crons,
 * brain hooks) MUST treat a `null` slot as "feature disabled" and fall
 * back to their existing behaviour — never throw on a disabled feature.
 */
export interface LitfinPortBundle {
  /** USSD session machine (Africa's-Talking webhook). Off ⇒ route unmounted. */
  readonly ussdEngine: UssdEngine | null;
  /** Belief-revision learning hook. Off ⇒ hook unmounted. */
  readonly beliefEngine: BeliefEngine | null;
  /** Action→outcome learning-signal emitter. Off ⇒ emitter unwired. */
  readonly learningSignalEmitter: LearningSignalEmitter | null;
  /** WORM ledger-attestation worker. Off ⇒ worker unmounted. */
  readonly ledgerAttestor: LedgerAttestor | null;
  /** Inbound multi-channel canonicaliser. Off ⇒ connector routes unmounted. */
  readonly channelGateway: ChannelGatewayFacade | null;
  /** Document fact-bag reconciliation. Off ⇒ route unmounted. */
  readonly documentReconciliation: DocumentReconciliation | null;
  /** Privacy-aware provider router. Off ⇒ callers keep existing selection. */
  readonly privacyRouter: PrivacyRouterFacade | null;
  /** Regulator audit-replay drill. Off ⇒ readiness route unmounted. */
  readonly regulatorSim: RegulatorSim | null;
  /** Blind-review panel + CI gate. Off ⇒ route + gate unmounted. */
  readonly blindReview: BlindReview | null;
}

/** Env shape the seam reads. Bootstrap (`index.ts`) already loaded dotenv. */
type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * Resolve one DEFAULT-OFF feature flag from the gateway env seam. Returns
 * `true` only for a literal `on` (case/space-insensitive); anything else —
 * unset, `off`, `false`, `0`, empty — is `false`. The package never reads
 * this; we pass the resolved boolean as `enabled`.
 */
function readPortFlag(env: EnvLike, flagName: string): boolean {
  const raw = env[flagName];
  if (!raw) return false;
  return raw.trim().toLowerCase() === 'on';
}

/**
 * Structured "not wired" rejection for a required port that has no shipped
 * in-memory default. Only ever reached when a flag is flipped `on` AND the
 * concrete per-tenant adapter has not yet been injected via this wiring.
 */
function notWired(featureFlag: string, port: string): never {
  throw new Error(
    `litfin-port-wiring: ${featureFlag} is on but its '${port}' adapter ` +
      'is not yet injected — wire the concrete adapter in ' +
      'services/api-gateway/src/composition/litfin-port-wiring.ts',
  );
}

/** Trace a flag flipped on so an operator sees the mount in logs. */
function traceEnabled(flagName: string): void {
  logger.info('litfin-port-wiring: feature enabled', { flag: flagName });
}

// ── Per-package builders ──────────────────────────────────────────────
// Each builder returns `null` in the default (OFF) path WITHOUT constructing
// any deps. Construction happens only inside the `on` branch.

function buildUssdEngine(env: EnvLike): UssdEngine | null {
  if (!readPortFlag(env, USSD_ENGINE_FLAG)) return null;
  traceEnabled(USSD_ENGINE_FLAG);
  // Session store ships an in-memory default; identity + data are per-tenant
  // ports injected as a follow-up. Stub shapes are inferred from the
  // `wireUssdEngine` deps contract (port types are package-internal).
  return wireUssdEngine({
    enabled: true,
    store: createInMemorySessionStore(),
    identity: {
      resolve: async () => notWired(USSD_ENGINE_FLAG, 'identity'),
    },
    data: {
      fetchLease: async () => notWired(USSD_ENGINE_FLAG, 'data'),
      fetchRent: async () => notWired(USSD_ENGINE_FLAG, 'data'),
      fetchMaintenance: async () => notWired(USSD_ENGINE_FLAG, 'data'),
      fetchMarketplace: async () => notWired(USSD_ENGINE_FLAG, 'data'),
      recordMeterReading: async () => notWired(USSD_ENGINE_FLAG, 'data'),
    },
  });
}

function buildBeliefEngine(env: EnvLike): BeliefEngine | null {
  if (!readPortFlag(env, BELIEF_ENGINE_FLAG)) return null;
  traceEnabled(BELIEF_ENGINE_FLAG);
  return wireBeliefEngine({
    enabled: true,
    store: createInMemoryBeliefStore(),
  });
}

function buildLearningSignalEmitter(env: EnvLike): LearningSignalEmitter | null {
  if (!readPortFlag(env, LEARNING_SIGNAL_EMITTER_FLAG)) return null;
  traceEnabled(LEARNING_SIGNAL_EMITTER_FLAG);
  // All ports optional — the emitter degrades safely with no sinks/store.
  return wireLearningSignalEmitter({ enabled: true });
}

function buildLedgerAttestor(env: EnvLike): LedgerAttestor | null {
  if (!readPortFlag(env, LEDGER_ATTESTOR_FLAG)) return null;
  traceEnabled(LEDGER_ATTESTOR_FLAG);
  // source/signer/sinks are infra ports (chain reader, KMS signer, WORM
  // sink) injected as a follow-up. Shapes match the package's public
  // ChainSourcePort / SignerPort / ExternalSinkPort contracts.
  return wireLedgerAttestor({
    enabled: true,
    source: {
      listSegments: async () => notWired(LEDGER_ATTESTOR_FLAG, 'source'),
    },
    signer: {
      keyId: 'not-wired',
      algorithm: 'not-wired',
      sign: async () => notWired(LEDGER_ATTESTOR_FLAG, 'signer'),
    },
    sinks: [
      {
        name: 'not-wired',
        publish: async () => notWired(LEDGER_ATTESTOR_FLAG, 'sinks'),
      },
    ],
  });
}

function buildChannelGateway(env: EnvLike): ChannelGatewayFacade | null {
  if (!readPortFlag(env, CHANNEL_GATEWAY_FLAG)) return null;
  traceEnabled(CHANNEL_GATEWAY_FLAG);
  // signature + tier are per-connector ports injected as a follow-up. Stub
  // shapes are inferred from the `wireChannelGateway` deps contract.
  return wireChannelGateway({
    enabled: true,
    signature: { verify: () => notWired(CHANNEL_GATEWAY_FLAG, 'signature') },
    tier: { resolve: async () => notWired(CHANNEL_GATEWAY_FLAG, 'tier') },
  });
}

function buildDocumentReconciliation(env: EnvLike): DocumentReconciliation | null {
  if (!readPortFlag(env, DOCUMENT_RECONCILIATION_FLAG)) return null;
  traceEnabled(DOCUMENT_RECONCILIATION_FLAG);
  // All ports optional — computes-and-returns without persistence by default.
  return wireDocumentReconciliation({ enabled: true });
}

function buildPrivacyRouter(env: EnvLike): PrivacyRouterFacade | null {
  if (!readPortFlag(env, PRIVACY_ROUTER_FLAG)) return null;
  traceEnabled(PRIVACY_ROUTER_FLAG);
  // pii + localHealth are infra ports injected as a follow-up.
  const pii: PiiStripperPort = {
    stripPii: () => notWired(PRIVACY_ROUTER_FLAG, 'pii'),
    containsPii: () => notWired(PRIVACY_ROUTER_FLAG, 'pii'),
  };
  const localHealth: LocalEndpointHealthPort = {
    isHealthy: async () => notWired(PRIVACY_ROUTER_FLAG, 'localHealth'),
  };
  return wirePrivacyRouter({ enabled: true, pii, localHealth });
}

function buildRegulatorSim(env: EnvLike): RegulatorSim | null {
  if (!readPortFlag(env, REGULATOR_SIM_FLAG)) return null;
  traceEnabled(REGULATOR_SIM_FLAG);
  return wireRegulatorSim({
    enabled: true,
    store: createRegulatorAuditStore(),
  });
}

function buildBlindReview(env: EnvLike): BlindReview | null {
  if (!readPortFlag(env, BLIND_REVIEW_FLAG)) return null;
  traceEnabled(BLIND_REVIEW_FLAG);
  // Store ships an in-memory default; fetcher is the decisions source,
  // injected as a follow-up. Stub shape is inferred from the
  // `wireBlindReview` deps contract.
  return wireBlindReview({
    enabled: true,
    fetcher: {
      fetchAi: async () => notWired(BLIND_REVIEW_FLAG, 'fetcher'),
      fetchHuman: async () => notWired(BLIND_REVIEW_FLAG, 'fetcher'),
    },
    store: createInMemoryBlindReviewStore(),
  });
}

/**
 * Build the newly-ported package bundle. Every member is `null` unless its
 * DEFAULT-OFF flag is `on`. Constructing the bundle has zero side effects in
 * the default path (no I/O, no port construction) — it is a frozen
 * projection of nine `null`s until an operator opts in.
 *
 * @param env Defaults to `process.env`. This is the bootstrap composition
 *   module, so reading the env here (after dotenv has loaded in `index.ts`)
 *   is the canonical seam; the ported packages themselves stay ENV-FREE.
 */
export function createLitfinPortBundle(
  env: EnvLike = process.env,
): LitfinPortBundle {
  return Object.freeze({
    ussdEngine: buildUssdEngine(env),
    beliefEngine: buildBeliefEngine(env),
    learningSignalEmitter: buildLearningSignalEmitter(env),
    ledgerAttestor: buildLedgerAttestor(env),
    channelGateway: buildChannelGateway(env),
    documentReconciliation: buildDocumentReconciliation(env),
    privacyRouter: buildPrivacyRouter(env),
    regulatorSim: buildRegulatorSim(env),
    blindReview: buildBlindReview(env),
  });
}

/**
 * Additive decorator for the composition entrypoint. Returns a NEW frozen
 * registry that is the original plus a `litfinPort` namespace — the original
 * object is never mutated and no existing slot is touched. Call this with
 * one additive line from `buildServices`.
 */
export function registerLitfinPortBundle<R extends object>(
  registry: R,
  env: EnvLike = process.env,
): R & { readonly litfinPort: LitfinPortBundle } {
  return Object.freeze({
    ...registry,
    litfinPort: createLitfinPortBundle(env),
  });
}
