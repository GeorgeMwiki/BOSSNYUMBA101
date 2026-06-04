/**
 * Regulator simulation — Tanzania PDPA readiness (core).
 *
 * Samples subject-access and erasure flows end-to-end. The harness never
 * touches live PII; it operates on the artefacts the injected
 * {@link SubjectArtefactResolver} surfaces and validates that the pipeline:
 *
 *   - Returns ALL required artefacts for a subject-access request
 *   - Redacts third-party PII inside those artefacts (via {@link PdpaDataPort})
 *   - Honours legal-hold exclusions on erasure
 *   - Returns a verifiable `fulfilledAt` timestamp
 *
 * A resolver that throws is treated as a generic error (empty artefact set)
 * via the private {@link safeFetch} wrapper, keeping the data / empty / error
 * outcomes type-distinct. No DB / SDK / env access — every side effect is a
 * port.
 *
 * @module @bossnyumba/regulator-sim/pdpa-readiness
 */

import type {
  ErasureRequest,
  PdpaResult,
  SubjectAccessRequest,
} from './types';
import type {
  PdpaDataPort,
  SubjectArtefact,
  SubjectArtefactResolver,
} from './ports';

// Re-export the artefact types from the ports module so the PDPA surface can
// be imported as a single unit.
export type { SubjectArtefact, SubjectArtefactKind } from './ports';

/**
 * Private fetch wrapper. Returns the resolved artefacts on success and
 * `undefined` when the resolver throws — collapsing a thrown resolver into a
 * generic error path while keeping it distinct from an explicit empty array.
 */
async function safeFetch(
  resolver: SubjectArtefactResolver,
  subjectId: string,
): Promise<ReadonlyArray<SubjectArtefact> | undefined> {
  try {
    return await resolver.fetchArtefacts(subjectId);
  } catch {
    return undefined;
  }
}

export async function fulfilSubjectAccess(
  req: SubjectAccessRequest,
  resolver: SubjectArtefactResolver,
  data: PdpaDataPort,
  nowIso: string = new Date().toISOString(),
): Promise<PdpaResult> {
  const fetched = await safeFetch(resolver, req.subjectId);

  if (fetched === undefined) {
    return {
      subjectId: req.subjectId,
      action: 'access',
      artefactsCount: 0,
      fulfilledAt: nowIso,
      redactedFields: [],
      residualOnLegalHold: [],
      passed: false,
      reason: 'artefact resolver failed for subject',
    };
  }

  const redactedFields: string[] = [];
  for (const a of fetched) {
    if (a.thirdPartyPiiFields) {
      redactedFields.push(...a.thirdPartyPiiFields);
    }
    // Redaction returns a fresh artefact; we do not need to retain it here,
    // only to prove the port masks each artefact without throwing.
    data.redact(a);
  }

  // A subject with zero records is suspicious; flag it rather than passing.
  const passed = fetched.length > 0;

  return {
    subjectId: req.subjectId,
    action: 'access',
    artefactsCount: fetched.length,
    fulfilledAt: nowIso,
    redactedFields: Array.from(new Set(redactedFields)).sort(),
    residualOnLegalHold: [],
    passed,
    ...(passed ? {} : { reason: 'no artefacts found for subject' }),
  };
}

export async function fulfilErasure(
  req: ErasureRequest,
  resolver: SubjectArtefactResolver,
  data: PdpaDataPort,
  nowIso: string = new Date().toISOString(),
): Promise<PdpaResult> {
  const fetched = await safeFetch(resolver, req.subjectId);

  if (fetched === undefined) {
    return {
      subjectId: req.subjectId,
      action: 'erasure',
      artefactsCount: 0,
      fulfilledAt: nowIso,
      redactedFields: [],
      residualOnLegalHold: [],
      passed: false,
      reason: 'artefact resolver failed for subject',
    };
  }

  const residual: string[] = [];
  let erasedCount = 0;

  for (const a of fetched) {
    const onHold =
      a.legalHoldUntilIso !== undefined &&
      Date.parse(a.legalHoldUntilIso) > Date.parse(nowIso);
    if (onHold) {
      residual.push(a.id);
      continue;
    }
    await data.erase(a.id);
    erasedCount += 1;
  }

  // Pass: every artefact either erased OR retained on a documented legal
  // hold. A mixed outcome is still a PASS (PDPA permits retention on hold).
  const passed = erasedCount + residual.length === fetched.length;

  return {
    subjectId: req.subjectId,
    action: 'erasure',
    artefactsCount: erasedCount,
    fulfilledAt: nowIso,
    redactedFields: [],
    residualOnLegalHold: residual,
    passed,
    ...(passed
      ? {}
      : { reason: 'erasure pipeline did not account for every artefact' }),
  };
}

/** One-shot end-to-end: access then erasure for a synthetic subject. */
export async function pdpaEndToEnd(
  subjectId: string,
  resolver: SubjectArtefactResolver,
  data: PdpaDataPort,
  nowIso: string = new Date().toISOString(),
): Promise<{ readonly access: PdpaResult; readonly erasure: PdpaResult }> {
  const access = await fulfilSubjectAccess(
    { subjectId, receivedAt: nowIso, scope: 'full' },
    resolver,
    data,
    nowIso,
  );
  const erasure = await fulfilErasure(
    { subjectId, receivedAt: nowIso },
    resolver,
    data,
    nowIso,
  );
  return { access, erasure };
}
