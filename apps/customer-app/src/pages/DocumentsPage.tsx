'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  Download,
  Upload,
  AlertCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  documents as documentsApi,
  type Document as ApiDocument,
} from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_OPTIONS = [
  { value: 'LEASE', label: 'Lease' },
  { value: 'ID_DOCUMENT', label: 'ID Document' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'OTHER', label: 'Other' },
];

interface UploadProgress {
  percent: number;
  filename: string;
}

/**
 * DocumentsPage — lists tenant-scoped documents, supports multipart
 * upload with progress reporting, and fetches signed download URLs
 * on demand.
 */
export default function DocumentsPage() {
  const auth = useAuth() as unknown as {
    user: { id?: string } | null;
    token: string | null;
    tenantId?: string;
  };
  const tenantId =
    auth.tenantId ??
    (typeof window !== 'undefined'
      ? window.localStorage.getItem('customer_tenant_id') ?? ''
      : '');

  const [docs, setDocs] = useState<ApiDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('OTHER');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    if (!tenantId) {
      setError('Missing tenant context. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await documentsApi.listDocuments({ tenantId });
      setDocs(response.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      setUploadError(null);
      if (!file) {
        setUploadError('Please choose a file');
        return;
      }
      if (!selectedCategory) {
        setUploadError('Please choose a category');
        return;
      }
      setUploadProgress({ percent: 0, filename: file.name });
      try {
        const response = await documentsApi.uploadDocument({
          file,
          category: selectedCategory,
          filename: file.name,
          onProgress: ({ percent }) =>
            setUploadProgress({ percent, filename: file.name }),
        });
        if (response.data) {
          setDocs((prev) => [response.data, ...prev]);
        }
        setUploadProgress(null);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : 'Failed to upload document'
        );
        setUploadProgress(null);
      }
    },
    [selectedCategory]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelected(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = useCallback(async (docId: string) => {
    setDownloadingId(docId);
    try {
      const response = await documentsApi.getDownloadUrl(docId);
      const url = response.data?.url;
      if (url && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch download URL'
      );
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return (
    <>
      <PageHeader title="Documents" showBack />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Upload form */}
        <section
          aria-labelledby="upload-heading"
          className="card p-4 space-y-3"
        >
          <h2 id="upload-heading" className="text-sm font-medium text-gray-700">
            Upload a document
          </h2>
          <label className="block">
            <span className="text-xs text-gray-500">Category</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              aria-label="Document category"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileInputChange}
            data-testid="documents-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!!uploadProgress}
            className="w-full h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-primary-500 transition-colors"
          >
            <Upload className="w-5 h-5 mb-1" />
            <span className="text-sm font-medium">Choose file</span>
          </button>

          {uploadProgress && (
            <div
              className="space-y-1"
              role="progressbar"
              aria-valuenow={uploadProgress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Uploading ${uploadProgress.filename}`}
            >
              <div className="flex justify-between text-xs text-gray-500">
                <span className="truncate">{uploadProgress.filename}</span>
                <span>{uploadProgress.percent}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all"
                  style={{ width: `${uploadProgress.percent}%` }}
                  data-testid="upload-progress-bar"
                />
              </div>
            </div>
          )}

          {uploadError && (
            <div
              role="alert"
              className="flex items-start gap-2 text-sm text-danger-700"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{uploadError}</p>
            </div>
          )}
        </section>

        {/* Documents list */}
        <section aria-labelledby="documents-heading" className="space-y-3">
          <h2
            id="documents-heading"
            className="text-sm font-medium text-gray-500"
          >
            Your documents
          </h2>

          {loading && (
            <div
              role="status"
              aria-live="polite"
              className="text-center text-sm text-gray-500 py-8"
            >
              Loading documents...
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="card p-4 flex items-start gap-3 bg-danger-50 border-danger-100"
            >
              <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-danger-900 mb-1">Error</h3>
                <p className="text-sm text-danger-800">{error}</p>
                <button
                  onClick={() => void fetchDocs()}
                  className="text-sm text-danger-700 underline mt-2"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && docs.length === 0 && (
            <div className="card p-6 text-center text-sm text-gray-500">
              No documents yet. Upload one above to get started.
            </div>
          )}

          {!loading && !error && docs.length > 0 && (
            <div
              className="card divide-y divide-gray-100"
              data-testid="documents-list"
            >
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-4"
                >
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {doc.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {doc.type}
                      {doc.size ? ` • ${Math.round(doc.size / 1024)} KB` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDownload(doc.id)}
                    disabled={downloadingId === doc.id}
                    className="btn-secondary text-sm flex items-center"
                    aria-label={`Download ${doc.name}`}
                  >
                    {downloadingId === doc.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-1" />
                    )}
                    Download
                  </button>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
