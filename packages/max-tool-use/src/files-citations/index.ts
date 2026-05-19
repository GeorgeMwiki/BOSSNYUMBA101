/**
 * Files + Citations API — public surface.
 *
 *   uploadFile({path, mime}): FileId
 *   analyzeWithCitations({fileIds, prompt}): {answer, citations}
 *
 * Closes L2 #3.
 */

export {
  createFilesCitationsClient,
  type FilesClientDeps,
  type AnalyzeWithCitationsRequest,
} from './files-client.js';

import { createFilesCitationsClient } from './files-client.js';
import type {
  CitedAnswer,
  FileId,
  FileUploadRequest,
  ClaudeModelId,
  TenantContext,
} from '../types.js';

export async function uploadFile(req: FileUploadRequest): Promise<FileId> {
  return createFilesCitationsClient().uploadFile(req);
}

export async function analyzeWithCitations(req: {
  readonly fileIds: ReadonlyArray<FileId>;
  readonly prompt: string;
  readonly model: ClaudeModelId;
  readonly tenantContext: TenantContext;
}): Promise<CitedAnswer> {
  return createFilesCitationsClient().analyzeWithCitations(req);
}
