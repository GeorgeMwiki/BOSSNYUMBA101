/**
 * Reference-adapter tests: the in-memory audit store's immutable update and
 * the PDPA surface's redaction / erasure side effects.
 */

import { describe, expect, it } from 'vitest';
import {
  createInMemoryAuditStore,
  createInMemoryPdpaSurface,
  replayAudit,
  type AuditReplayInput,
  type SubjectArtefact,
} from './index';

const emptyInput: AuditReplayInput = {
  fromIso: '2026-06-01T00:00:00.000Z',
  toIso: '2026-06-30T00:00:00.000Z',
  records: [],
  fairnessTolerance: 0.1,
  registeredModelIds: [],
  allowedReasonCodes: [],
  modelCardMaxAgeDays: 90,
};

describe('createInMemoryAuditStore', () => {
  it('persists, updates immutably, and ends a run', async () => {
    const store = createInMemoryAuditStore();
    const created = await store.create({
      runId: 'run-1',
      status: 'pending',
      startedAt: '2026-06-03T12:00:00.000Z',
    });
    expect(created.status).toBe('pending');

    const result = replayAudit(emptyInput, '2026-06-03T12:00:00.000Z');
    const updated = await store.update('run-1', {
      status: 'complete',
      completedAt: '2026-06-03T12:00:01.000Z',
      result,
    });
    expect(updated.status).toBe('complete');
    expect(updated.result?.passed).toBe(true);
    // Immutability: the original created object is untouched.
    expect(created.status).toBe('pending');

    await store.end('run-1');
    expect(await store.get('run-1')).toBeNull();
  });

  it('throws when updating an unknown run', async () => {
    const store = createInMemoryAuditStore();
    await expect(store.update('missing', { status: 'complete' })).rejects.toThrow(
      /not found/,
    );
  });
});

describe('createInMemoryPdpaSurface', () => {
  const artefacts: ReadonlyArray<SubjectArtefact> = [
    {
      subjectId: 's1',
      kind: 'document',
      id: 'd1',
      contents: 'tenant s1 and neighbour Juma Said',
      thirdPartyPiiFields: ['Juma Said'],
    },
  ];

  it('redacts without mutating the source artefact', () => {
    const surface = createInMemoryPdpaSurface(artefacts);
    const original = surface.snapshot()[0]!;
    const redacted = surface.redact(original);
    expect(redacted.contents).toContain('[REDACTED]');
    expect(redacted.contents).not.toContain('Juma Said');
    // Source unchanged (immutability).
    expect(original.contents).toContain('Juma Said');
  });

  it('returns the artefact untouched when there is no third-party PII', () => {
    const surface = createInMemoryPdpaSurface([
      { subjectId: 's2', kind: 'document', id: 'd2', contents: 'no pii here' },
    ]);
    const a = surface.snapshot()[0]!;
    expect(surface.redact(a)).toBe(a);
  });

  it('erases by id and reflects it in the snapshot', async () => {
    const surface = createInMemoryPdpaSurface(artefacts);
    await surface.erase('d1');
    expect(surface.snapshot()).toHaveLength(0);
  });
});
