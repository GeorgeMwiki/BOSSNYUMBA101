/**
 * Files + Citations API client.
 *
 *   uploadFile({path, mime}): FileId
 *   analyzeWithCitations({fileIds, prompt}): {answer, citations}
 *
 * Citations are FREE in Anthropic's pricing — every claim cited to
 * page+span. Pairs with J2's conversational ingest — owner drops a lease
 * PDF, MD answers + cites every claim.
 *
 * Closes L2 #3.
 */

import type {
  CitationLocation,
  CitedAnswer,
  ClaudeModelId,
  FileId,
  FileUploadRequest,
  SupportedFileMime,
  TenantContext,
} from '../types.js';

const SUPPORTED_MIMES: ReadonlyArray<SupportedFileMime> = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/rtf',
  'text/html',
  'application/epub+zip',
  'application/vnd.oasis.opendocument.text',
];

const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;
const MAX_FILES_PER_CONVERSATION = 20;

export interface FilesClientDeps {
  /** Anthropic Files API beta upload — when undefined, synthetic in-memory store. */
  readonly anthropicFilesUpload?: (
    req: FileUploadRequest,
  ) => Promise<{ fileId: string; sha256: string }>;
  /** Anthropic Messages API with citations:true. */
  readonly anthropicMessagesWithCitations?: (args: {
    readonly fileIds: ReadonlyArray<FileId>;
    readonly prompt: string;
    readonly model: ClaudeModelId;
    readonly tenantContext: TenantContext;
  }) => Promise<CitedAnswer>;
  readonly clock?: () => number;
  readonly fileSizeProbe?: (path: string) => Promise<number>;
  readonly randomId?: () => string;
}

export interface AnalyzeWithCitationsRequest {
  readonly fileIds: ReadonlyArray<FileId>;
  readonly prompt: string;
  readonly model: ClaudeModelId;
  readonly tenantContext: TenantContext;
}

export function createFilesCitationsClient(deps: FilesClientDeps = {}) {
  const randomId = deps.randomId ?? (() => `file_${Math.random().toString(36).slice(2)}`);
  const probe = deps.fileSizeProbe ?? (async () => 1024);

  // Synthetic in-memory file store for tests.
  const store = new Map<
    string,
    { mime: SupportedFileMime; title: string; tenantId: string }
  >();

  return {
    async uploadFile(req: FileUploadRequest): Promise<FileId> {
      if (!SUPPORTED_MIMES.includes(req.mime)) {
        throw new Error(`Unsupported MIME ${req.mime}`);
      }
      const size = await probe(req.path);
      if (size > MAX_FILE_SIZE_BYTES) {
        throw new Error(
          `File ${req.path} exceeds 30 MB (${size} bytes)`,
        );
      }
      if (deps.anthropicFilesUpload) {
        const r = await deps.anthropicFilesUpload(req);
        return { value: r.fileId };
      }
      const id = randomId();
      store.set(id, {
        mime: req.mime,
        title: req.title ?? req.path,
        tenantId: req.tenantContext.tenantId,
      });
      return { value: id };
    },

    async analyzeWithCitations(
      req: AnalyzeWithCitationsRequest,
    ): Promise<CitedAnswer> {
      if (req.fileIds.length === 0) {
        throw new Error('At least one fileId is required');
      }
      if (req.fileIds.length > MAX_FILES_PER_CONVERSATION) {
        throw new Error(
          `Too many files: ${req.fileIds.length} > ${MAX_FILES_PER_CONVERSATION}`,
        );
      }
      for (const fid of req.fileIds) {
        const meta = store.get(fid.value);
        if (
          meta &&
          meta.tenantId !== req.tenantContext.tenantId
        ) {
          throw new Error(
            `Tenant isolation breach: file ${fid.value} belongs to other tenant`,
          );
        }
      }

      if (deps.anthropicMessagesWithCitations) {
        return deps.anthropicMessagesWithCitations(req);
      }

      // Synthetic cited answer for tests
      const citations: ReadonlyArray<CitationLocation> = req.fileIds.map(
        (fid, i) => {
          const meta = store.get(fid.value);
          return {
            fileId: fid,
            title: meta?.title ?? fid.value,
            type: 'page_location',
            start: 1 + i,
            end: 2 + i,
            citedText: `[synthetic excerpt #${i + 1} from ${meta?.title ?? fid.value}]`,
          };
        },
      );
      const citedTokenFreeBytes = citations.reduce(
        (acc, c) => acc + c.citedText.length,
        0,
      );
      return {
        answer: `Per the supplied document(s), the answer to "${req.prompt}" cites ${citations.length} source(s).`,
        citations,
        citedTokenFreeBytes,
      };
    },

    /** Test-only — returns stored metadata. */
    _inspect(): ReadonlyMap<string, { mime: SupportedFileMime; title: string; tenantId: string }> {
      return new Map(store);
    },
  };
}
