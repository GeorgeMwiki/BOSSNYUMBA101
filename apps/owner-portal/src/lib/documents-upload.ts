/**
 * Multipart document upload helper.
 *
 * The shared `api` client (`./api`) JSON-stringifies every body, so it cannot
 * carry a binary `multipart/form-data` payload. This thin helper posts a
 * `FormData` to `POST /documents/upload` using the SAME base-URL + bearer-token
 * resolution the `api` client uses, so auth and routing stay consistent.
 *
 * The browser MUST set the multipart `Content-Type` (with its boundary)
 * itself — we deliberately do NOT set a `Content-Type` header here.
 */

import type { OwnerDocument } from './hooks';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    const trimmed = configured.replace(/\/$/, '');
    return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
  }
  if (import.meta.env.PROD) {
    throw new Error('owner-portal: VITE_API_URL is required in production builds.');
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000/api/v1';
  }
  return '/api/v1';
}

export interface UploadDocumentInput {
  readonly file: File;
  readonly name?: string;
  readonly type?: string;
  readonly customerId?: string;
  readonly relatedEntityType?: string;
  readonly relatedEntityId?: string;
}

/**
 * POST a single file to the documents router. Resolves to the created
 * `OwnerDocument` on success and throws a descriptive `Error` otherwise so the
 * caller can surface the message to the user.
 */
export async function uploadDocument(
  input: UploadDocumentInput,
): Promise<OwnerDocument> {
  const form = new FormData();
  form.append('file', input.file, input.file.name);
  if (input.name) form.append('name', input.name);
  if (input.type) form.append('type', input.type);
  if (input.customerId) form.append('customerId', input.customerId);
  if (input.relatedEntityType)
    form.append('relatedEntityType', input.relatedEntityType);
  if (input.relatedEntityId)
    form.append('relatedEntityId', input.relatedEntityId);

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  let response: Response;
  try {
    response = await fetch(`${resolveApiBase()}/documents/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : 'Network error during upload.',
    );
  }

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  let body: ApiEnvelope<OwnerDocument>;
  try {
    body = (await response.json()) as ApiEnvelope<OwnerDocument>;
  } catch {
    throw new Error('Upload failed: malformed server response.');
  }

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error?.message ?? 'Document upload failed.');
  }

  return body.data;
}
