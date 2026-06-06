/**
 * Upload orchestration for maintenance-case intake photos.
 *
 * Extracted from `requests/new` so the create → upload-each →
 * collect-failures flow is unit-testable without rendering the whole
 * form. The page owns the UI; this module owns the honest accounting of
 * which uploads succeeded and which did not.
 */

/** Minimal shape of a captured photo this flow can upload. */
export interface UploadablePhoto {
  readonly id: string;
  readonly file?: File;
}

/** The single network call this flow depends on (injected for testing). */
export type EvidenceUploader = (
  caseId: string,
  file: File,
  meta?: { caption?: string; fileName?: string },
) => Promise<unknown>;

export interface UploadEvidenceResult {
  /** Total blob-backed photos that were attempted. */
  readonly attempted: number;
  /** Photos whose upload rejected — empty on full success. */
  readonly failed: readonly UploadablePhoto[];
}

/**
 * Upload every blob-backed photo to the given case, concurrently, each
 * settled independently so one failure never aborts the rest. Photos
 * without a `file` (e.g. already-remote previews) are skipped. The
 * returned `failed` list lets the caller report a truthful partial
 * outcome and retry only the failures.
 */
export async function uploadCaseEvidence(
  caseId: string,
  photos: readonly UploadablePhoto[],
  upload: EvidenceUploader,
): Promise<UploadEvidenceResult> {
  const pending = photos.filter(
    (p): p is UploadablePhoto & { file: File } => p.file instanceof File,
  );
  if (pending.length === 0) {
    return { attempted: 0, failed: [] };
  }

  const results = await Promise.allSettled(
    pending.map((p) => upload(caseId, p.file, { fileName: p.file.name })),
  );

  const failed = pending.filter((_, i) => results[i]?.status === 'rejected');
  return { attempted: pending.length, failed };
}
