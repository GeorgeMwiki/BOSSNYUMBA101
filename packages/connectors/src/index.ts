/**
 * @bossnyumba/connectors — public surface.
 *
 * Every external integration BossNyumba ships should compose through
 * `createBaseConnector` so it inherits common rate-limiting / circuit-breaker
 * / retry / audit / event-bus discipline. The two adapters here (M-Pesa,
 * credit bureau) are illustrative; real adapters live alongside their
 * domain code.
 */

export {
  createBaseConnector,
  type AuditSink,
  type BaseConnector,
  type BaseConnectorDeps,
  type CircuitHealth,
  type ConnectorAuth,
  type ConnectorConfig,
  type ConnectorEvent,
  type ConnectorEventSink,
  type ConnectorOutcome,
  type ConnectorRequest,
} from './base-connector.js';

export { createInMemoryEventSink, type InMemoryEventSink } from './in-memory-event-sink.js';
export { createInMemoryAuditSink, type InMemoryAuditSink } from './in-memory-audit-sink.js';

export {
  createMpesaAdapter,
  InitiatePaymentInputSchema,
  InitiatePaymentOutputSchema,
  type InitiatePaymentInput,
  type InitiatePaymentOutput,
  type MpesaAdapter,
  type MpesaAdapterDeps,
} from './adapters/mpesa-adapter.js';

export {
  createCreditBureauAdapter,
  FetchScoreInputSchema,
  CreditScoreReportSchema,
  type CreditBureauAdapter,
  type CreditBureauAdapterDeps,
  type CreditScoreReport,
  type FetchScoreInput,
} from './adapters/credit-bureau-adapter.js';

export {
  createNidaAdapter,
  NidaNumberSchema,
  BiometricHashSchema,
  VerifyIdentityInputSchema,
  VerifyIdentityOutputSchema,
  type NidaAdapter,
  type NidaAdapterDeps,
  type VerifyIdentityInput,
  type VerifyIdentityOutput,
} from './adapters/nida-adapter.js';

export {
  createEardhiAdapter,
  TitleNumberSchema,
  VerifyTitleInputSchema,
  VerifyTitleOutputSchema,
  EncumbranceSchema,
  type EardhiAdapter,
  type EardhiAdapterDeps,
  type VerifyTitleInput,
  type VerifyTitleOutput,
  type Encumbrance,
} from './adapters/eardhi-adapter.js';

export * from './registry.js';
export * from './orchestrator.js';
export * from './health-scheduler.js';
