/**
 * Reusable file-upload widget for the documents surface.
 *
 * Drag-drop + click-to-select. POSTs to `/api/v1/documents` (gateway expects
 * a `multipart/form-data` body). Caller passes `onUploaded` so the parent
 * can refresh its document list once the upload succeeds.
 *
 * The exposed `<input type="file" />` is required by the E2E spec which
 * looks for `input[type="file"]` on the documents surface — we keep it
 * present in the DOM (visually hidden) so playwright's `setInputFiles`
 * works without needing to click the drop target first.
 */
'use client';

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, UploadCloud, CheckCircle2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';

const ACCEPT_DEFAULT = 'image/*,application/pdf';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

interface UploadProps {
  readonly accept?: string;
  readonly onUploaded?: (id: string) => void;
  readonly label?: string;
  readonly relatedEntityType?: string;
  readonly relatedEntityId?: string;
  readonly documentType?: string;
}

interface UploadResult {
  readonly id?: string;
  readonly name?: string;
}

function token(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('customer_token') ?? ''
    : '';
}

async function uploadFile(
  file: File,
  meta: {
    relatedEntityType?: string;
    relatedEntityId?: string;
    documentType?: string;
  },
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('name', file.name);
  formData.append('mimeType', file.type || 'application/octet-stream');
  formData.append('size', String(file.size));
  if (meta.documentType) formData.append('type', meta.documentType);
  if (meta.relatedEntityType)
    formData.append('relatedEntityType', meta.relatedEntityType);
  if (meta.relatedEntityId)
    formData.append('relatedEntityId', meta.relatedEntityId);

  const auth = token();
  const res = await fetch(`${getApiBaseUrl()}/documents`, {
    method: 'POST',
    headers: {
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...getCsrfHeaders(),
    },
    body: formData,
  });

  let body: {
    success?: boolean;
    data?: UploadResult;
    error?: { message?: string };
  } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // ignore — some 5xx responses have no JSON body
  }

  if (!res.ok) {
    throw new Error(body.error?.message ?? `Upload failed (HTTP ${res.status})`);
  }
  return body.data ?? {};
}

export function FileUpload({
  accept = ACCEPT_DEFAULT,
  onUploaded,
  label,
  relatedEntityType,
  relatedEntityId,
  documentType,
}: UploadProps) {
  const t = useTranslations('p89.fileUpload');
  const resolvedLabel = label ?? t('defaultLabel');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];

      if (file.size > MAX_BYTES) {
        setError(`File too large — max 10MB`);
        return;
      }

      setError(null);
      setSuccess(null);
      setUploading(true);
      try {
        const result = await uploadFile(file, {
          relatedEntityType,
          relatedEntityId,
          documentType,
        });
        setSuccess(file.name);
        if (result.id && onUploaded) onUploaded(result.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onUploaded, relatedEntityType, relatedEntityId, documentType],
  );

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      void handleFiles(e.target.files);
    },
    [handleFiles],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  return (
    <div data-testid="file-upload" className="space-y-2">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label={resolvedLabel}
        className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-700 bg-gray-800 hover:bg-gray-800/70'
        }`}
      >
        {uploading ? (
          <p className="text-sm text-gray-300 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </p>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-200 font-medium">{resolvedLabel}</p>
            <p className="text-xs text-gray-500 mt-1">
              Drop file here, or click to choose
            </p>
          </>
        )}
      </div>

      {/*
       * The file input itself is hidden from sighted users but kept in the
       * DOM (`sr-only` rather than `hidden`) so playwright's
       * `setInputFiles` can attach a file without needing to first dispatch
       * a click on the drop target. The E2E spec asserts
       * `input[type="file"]` is attached, not visible.
       */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="sr-only"
        data-testid="file-upload-input"
        aria-hidden="true"
        tabIndex={-1}
      />

      {error && (
        <div
          role="alert"
          className="rounded bg-red-900/30 border border-red-500/40 text-red-200 p-2 text-xs"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 p-2 text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Uploaded {success}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
