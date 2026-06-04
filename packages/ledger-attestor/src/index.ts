/**
 * `@bossnyumba/ledger-attestor` — public surface.
 *
 * Tamper-evidence control for the rent/treasury ledger and the AI
 * audit chain. Computes a Merkle root over a hash-chain segment (built
 * on `@bossnyumba/audit-hash-chain`), signs the root via an injected
 * `SignerPort`, and publishes the signed checkpoint to a pluggable
 * `ExternalSinkPort` (object-lock WORM store / transparency log).
 *
 * Everything is behind a port, so the orchestrator (`runAttestation`)
 * is pure and unit-testable. The package is wired behind a default-OFF
 * feature flag via `wireLedgerAttestor` — a scheduled worker in the
 * composition root calls `handle()` per tick.
 */

// Wiring (off-flag facade)
export {
  wireLedgerAttestor,
  LEDGER_ATTESTOR_FLAG,
  type LedgerAttestor,
  type LedgerAttestorInput,
  type WireLedgerAttestorDeps,
} from './wire';

// Orchestrator
export { runAttestation, type AttestorDeps } from './attestor';

// Merkle
export { computeMerkleRoot, hashLeaf, EMPTY_MERKLE_ROOT } from './merkle';

// Checkpoint serialisation
export { serializeCheckpoint } from './checkpoint';

// Default signer (reference adapter)
export {
  createEd25519Signer,
  verifyEd25519,
  type Ed25519SignerConfig,
  type Ed25519SignerHandle,
} from './ed25519-signer';

// In-memory reference adapters (tests/dev)
export {
  createInMemorySink,
  createInMemoryCheckpointStore,
  type InMemorySink,
  type InMemorySinkOptions,
} from './in-memory-store';

// Object-lock / transparency-log sink
export {
  createObjectLockSink,
  type ObjectPutPort,
  type ObjectPutRequest,
  type ObjectPutResult,
  type ObjectLockSinkConfig,
} from './s3-object-lock-sink';

// Ports + seam helpers
export {
  systemClock,
  noopLogger,
  type Clock,
  type ChainSourcePort,
  type SignerPort,
  type ExternalSinkPort,
  type CheckpointStorePort,
  type AuditSinkPort,
  type AttestorLogger,
} from './ports';

// Domain types + boundary schemas
export {
  attestationRequestSchema,
  chainLeafSchema,
  type AttestationRequest,
  type AttestationRunResult,
  type ChainAttestationOutcome,
  type ChainLeaf,
  type ChainSegment,
  type CheckpointPayload,
  type ExternalSinkReceipt,
  type Signature,
  type SignedCheckpoint,
} from './types';
