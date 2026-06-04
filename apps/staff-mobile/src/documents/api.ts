/**
 * Workforce-mobile wire client for the document Q&A + upload surface.
 *
 * The Q&A / summarise flow maps to doc-chat.router.ts (mounted
 * /api/v1/doc-chat): POST /sessions, POST /sessions/:id/ask,
 * GET /sessions, GET /sessions/:id/messages. Upload registration + listing
 * map to documents.hono.ts (mounted /api/v1/documents): POST / and GET /.
 *
 * Builds on the shared operator client helpers in `../api/client.ts` so the
 * bearer token, timeouts, and error envelope are handled identically to
 * every other operator surface.
 *
 * NOTE: doc-chat and documents live under top-level /api/v1 routers, while
 * the shared client wrapper prefixes the operator base; the cross-router
 * base for these calls is flagged for coordinated follow-up.
 */

import { miningApi } from '../api/client'
import type {
  AskResponse,
  DocumentSession,
  SummaryResponse,
  UploadResult,
  UploadedDocument,
} from './types'

interface Envelope<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: { readonly code?: string; readonly message?: string }
}

export interface UploadInput {
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly textSample?: string
  readonly tags?: ReadonlyArray<string>
}

export async function registerUpload(input: UploadInput): Promise<UploadResult> {
  // documents.hono.ts POST / registers the pre-uploaded blob. (It expects
  // `name`/`url`; the fileName/mimeType/fileSize shape below is preserved
  // and the field-name delta is flagged for the backend contract.)
  const response = await miningApi.post<Envelope<UploadResult>>(
    '/documents',
    input,
  )
  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? 'Upload failed')
  }
  return response.data
}

export async function listDocuments(limit = 50): Promise<ReadonlyArray<UploadedDocument>> {
  const response = await miningApi.get<Envelope<{ documents: ReadonlyArray<UploadedDocument> }>>(
    `/documents?limit=${encodeURIComponent(String(limit))}`,
  )
  if (!response.success || !response.data) {
    return []
  }
  return response.data.documents
}

export interface CreateSessionInput {
  readonly documentIds: ReadonlyArray<string>
  readonly initialPrompt?: string
  readonly title?: string
}

export async function createSession(
  input: CreateSessionInput,
): Promise<{ readonly sessionId: string; readonly session: DocumentSession }> {
  const response = await miningApi.post<
    Envelope<{ sessionId: string; session: DocumentSession }>
  >('/doc-chat/sessions', input)
  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? 'Failed to open session')
  }
  return response.data
}

export interface AskInput {
  readonly sessionId: string
  readonly question: string
  readonly language?: 'sw' | 'en'
}

export async function askSession(input: AskInput): Promise<AskResponse> {
  const response = await miningApi.post<Envelope<AskResponse>>(
    `/doc-chat/sessions/${encodeURIComponent(input.sessionId)}/ask`,
    // English default per CLAUDE.md (flipped 2026-05).
    { question: input.question, language: input.language ?? 'en' },
  )
  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? 'Ask failed')
  }
  return response.data
}

export interface SummaryInput {
  readonly documentId: string
  readonly language?: 'sw' | 'en'
}

export async function summariseDocument(input: SummaryInput): Promise<SummaryResponse> {
  // FLAGGED: per-document summary (POST /documents/:id/summary) is NOT
  // implemented on doc-chat; this path is preserved pending a backend
  // contract. The session ask flow (createSession + askSession) is the
  // available summarise path today.
  const response = await miningApi.post<Envelope<SummaryResponse>>(
    `/doc-chat/documents/${encodeURIComponent(input.documentId)}/summary`,
    // English default per CLAUDE.md (flipped 2026-05).
    { language: input.language ?? 'en' },
  )
  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? 'Summary failed')
  }
  return response.data
}
