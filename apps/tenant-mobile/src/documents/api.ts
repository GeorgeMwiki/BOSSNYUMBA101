/**
 * Tenant-mobile wire client for the document Q&A surface.
 *
 * Two backend routers back this client:
 *   - document registration + listing → documents.hono.ts, mounted at
 *     `/api/v1/documents` (DOCUMENTS_PREFIX).
 *   - chat-with-your-documents sessions + ask → doc-chat.router.ts,
 *     mounted at `/api/v1/doc-chat` (DOC_CHAT_PREFIX): POST `/sessions`,
 *     POST `/sessions/:id/ask`, GET `/sessions`, GET
 *     `/sessions/:id/messages`.
 *
 * Builds on the apiFetch helper so the bearer token + envelope handling
 * stay identical to every other tenant-mobile API call.
 */

import { apiFetch } from '@/api/client'
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

const DOCUMENTS_PREFIX = '/api/v1/documents'
const DOC_CHAT_PREFIX = '/api/v1/doc-chat'

export interface UploadInput {
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly textSample?: string
  readonly tags?: ReadonlyArray<string>
}

export async function registerUpload(input: UploadInput): Promise<UploadResult> {
  // NOTE (flagged): documents.hono POST `/` expects { name, mimeType,
  // size, url } for a pre-uploaded blob; this client still sends the
  // legacy { fileName, fileSize, textSample, tags } shape. The request
  // body needs reconciling with the real schema in a follow-up.
  const response = await apiFetch<Envelope<UploadResult>>(`${DOCUMENTS_PREFIX}`, {
    method: 'POST',
    body: input,
  })
  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? 'Upload failed')
  }
  return response.data
}

export async function listDocuments(limit = 50): Promise<ReadonlyArray<UploadedDocument>> {
  const response = await apiFetch<Envelope<{ documents: ReadonlyArray<UploadedDocument> }>>(
    `${DOCUMENTS_PREFIX}?limit=${encodeURIComponent(String(limit))}`,
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
  const response = await apiFetch<Envelope<{ sessionId: string; session: DocumentSession }>>(
    `${DOC_CHAT_PREFIX}/sessions`,
    { method: 'POST', body: input },
  )
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
  const response = await apiFetch<Envelope<AskResponse>>(
    `${DOC_CHAT_PREFIX}/sessions/${encodeURIComponent(input.sessionId)}/ask`,
    {
      method: 'POST',
      body: { question: input.question, language: input.language ?? 'en' },
    },
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
  // NOTE (flagged): there is no per-document summary endpoint on the
  // doc-chat router today (only session create + ask). This points at
  // the doc-chat family for when it lands; until then it resolves to a
  // 404, same as the prior path. Prefer createSession + askSession.
  const response = await apiFetch<Envelope<SummaryResponse>>(
    `${DOC_CHAT_PREFIX}/documents/${encodeURIComponent(input.documentId)}/summary`,
    {
      method: 'POST',
      body: { language: input.language ?? 'en' },
    },
  )
  if (!response.success || !response.data) {
    throw new Error(response.error?.message ?? 'Summary failed')
  }
  return response.data
}
