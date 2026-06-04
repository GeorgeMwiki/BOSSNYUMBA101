/**
 * Object-lock external sink (WORM).
 *
 * Publishes a signed checkpoint as an immutable object under
 * Object-Lock (Write-Once-Read-Many) retention. Once written under a
 * COMPLIANCE-mode retention, the object cannot be overwritten or
 * deleted by ANY principal — including root — until the retention
 * period elapses. That is the tamper-evidence guarantee: an attacker
 * who edits the rent ledger or an audit row cannot also rewrite the
 * historical Merkle roots that would expose the edit.
 *
 * We DO NOT depend on any cloud SDK here — the actual put is injected
 * via {@link ObjectPutPort}. This keeps `@bossnyumba/ledger-attestor`
 * dependency-light, lets the gateway/worker own the SDK version, and
 * makes the sink unit-testable with a fake put. The same port shape
 * fits a transparency-log adapter (an append-only `POST /entries`) —
 * swap the `ObjectPutPort` for an HTTP append and reuse the sink.
 *
 * Object key layout (sortable, one object per checkpoint):
 *   {prefix}/{chainId}/{attestedAtIso}-{merkleRoot}.json
 *
 * @module @bossnyumba/ledger-attestor/s3-object-lock-sink
 */

import { systemClock, type Clock, type ExternalSinkPort } from './ports';
import type { ExternalSinkReceipt, SignedCheckpoint } from './types';

/** What the sink hands the injected backend to write. */
export interface ObjectPutRequest {
  readonly bucket: string;
  readonly key: string;
  readonly body: string;
  readonly contentType: string;
  /** ISO 8601 retain-until — backend maps to the object-lock retain-until date. */
  readonly retainUntilIso: string;
  /** `COMPLIANCE` (immutable even to root) or `GOVERNANCE` (bypassable by a privileged role). */
  readonly retentionMode: 'COMPLIANCE' | 'GOVERNANCE';
}

export interface ObjectPutResult {
  /** Object versionId (or any opaque locator the backend returns). */
  readonly versionId: string;
}

/**
 * Injected write backend. Production wires this to a put-object call
 * with object-lock mode + retain-until date. MUST throw on failure so
 * the orchestrator records a failed attestation (fail-loud).
 */
export interface ObjectPutPort {
  put(req: ObjectPutRequest): Promise<ObjectPutResult>;
}

export interface ObjectLockSinkConfig {
  readonly bucket: string;
  /** Key prefix, e.g. `ledger-attestations`. */
  readonly prefix: string;
  /** Object-lock retention window in days (regulatory retention). */
  readonly retentionDays: number;
  readonly retentionMode?: 'COMPLIANCE' | 'GOVERNANCE';
  readonly name?: string;
  /** Injectable clock (retain-until = now + retentionDays). */
  readonly clock?: Clock;
}

/** Sanitise a chainId for safe use inside an object key. */
function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._:-]/g, '_');
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function createObjectLockSink(
  put: ObjectPutPort,
  config: ObjectLockSinkConfig,
): ExternalSinkPort {
  const name = config.name ?? 'object-lock';
  const retentionMode = config.retentionMode ?? 'COMPLIANCE';
  const clock = config.clock ?? systemClock;

  return {
    name,
    async publish(checkpoint: SignedCheckpoint): Promise<ExternalSinkReceipt> {
      const { payload } = checkpoint;
      const key =
        `${config.prefix}/${safeSegment(payload.chainId)}/` +
        `${payload.attestedAtIso}-${payload.merkleRoot}.json`;
      const retainUntilIso = new Date(
        clock.now().getTime() + config.retentionDays * MS_PER_DAY,
      ).toISOString();

      const result = await put.put({
        bucket: config.bucket,
        key,
        body: JSON.stringify(checkpoint),
        contentType: 'application/json',
        retainUntilIso,
        retentionMode,
      });

      return Object.freeze({
        sink: name,
        locator: `s3://${config.bucket}/${key}#${result.versionId}`,
      });
    },
  };
}
