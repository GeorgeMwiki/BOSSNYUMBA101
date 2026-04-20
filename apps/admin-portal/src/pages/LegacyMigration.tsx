/**
 * Legacy LPMS migration — Wave 15 UI gap closure.
 *
 *   POST /api/v1/lpms/import   — preview / commit
 *   GET  /api/v1/lpms/preview-schema
 */

import React, { useCallback, useEffect, useState } from 'react';
import { UploadCloud, Loader2, FileCheck2 } from 'lucide-react';
import { api } from '../lib/api';

type Format = 'csv' | 'json' | 'xml';

interface PreviewResult {
  readonly format: Format;
  readonly tenantId: string;
  readonly counts: Record<string, number>;
  readonly issues?: readonly string[];
}

export default function LegacyMigration(): JSX.Element {
  const [format, setFormat] = useState<Format>('csv');
  const [content, setContent] = useState('');
  const [schema, setSchema] = useState<unknown>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<unknown>('/lpms/preview-schema')
      .then((res) => {
        if (res.success) setSchema(res.data);
      });
  }, []);

  const handleFile = useCallback(
    async (file: File): Promise<void> => {
      const text = await file.text();
      setContent(text);
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv' || ext === 'json' || ext === 'xml') setFormat(ext);
    },
    [],
  );

  async function doPreview(): Promise<void> {
    if (!content) return;
    setLoading(true);
    setError(null);
    const res = await api.post<PreviewResult>('/lpms/import', {
      format,
      content,
      commit: false,
      bestEffort: true,
    });
    setLoading(false);
    if (res.success && res.data) setPreview(res.data);
    else setError(res.error ?? 'Preview failed.');
  }

  async function commit(): Promise<void> {
    if (!content) return;
    if (!window.confirm('Commit legacy data to the database?')) return;
    setLoading(true);
    setError(null);
    const res = await api.post<PreviewResult>('/lpms/import', {
      format,
      content,
      commit: true,
    });
    setLoading(false);
    if (res.success && res.data) {
      setPreview(res.data);
      alert('Committed.');
    } else {
      setError(res.error ?? 'Commit failed.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <UploadCloud className="h-6 w-6 text-indigo-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Legacy LPMS migration
          </h2>
          <p className="text-sm text-gray-500">
            Upload legacy exports, preview, then commit.
          </p>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <label className="block text-sm">
          <span className="text-gray-700">File</span>
          <input
            type="file"
            accept=".csv,.json,.xml"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            className="mt-1 w-full text-sm"
            data-testid="lpms-upload"
          />
        </label>

        <div className="flex items-center gap-3">
          <label className="text-sm">
            Format:
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="xml">XML</option>
            </select>
          </label>
          <span className="text-xs text-gray-500">
            {content ? `${content.length.toLocaleString()} chars loaded` : 'no file'}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void doPreview()}
            disabled={!content || loading}
            className="rounded bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            ) : null}
            Preview
          </button>
          <button
            type="button"
            onClick={() => void commit()}
            disabled={!content || loading || !preview}
            className="rounded border border-indigo-600 text-indigo-600 px-4 py-2 text-sm disabled:opacity-50"
          >
            Commit
          </button>
        </div>
      </section>

      {preview && (
        <section className="bg-white border border-emerald-200 rounded-xl p-5 space-y-2">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-emerald-600" /> Preview
          </h3>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {Object.entries(preview.counts).map(([k, v]) => (
              <li
                key={k}
                className="bg-emerald-50 rounded p-2 text-emerald-800"
              >
                <span className="font-semibold">{v}</span> {k}
              </li>
            ))}
          </ul>
          {preview.issues && preview.issues.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-amber-700">
                {preview.issues.length} issues
              </summary>
              <ul className="list-disc ml-5 mt-2">
                {preview.issues.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {schema !== null && (
        <details className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
          <summary className="cursor-pointer font-medium text-gray-700">
            Target schema
          </summary>
          <pre className="mt-3 text-xs overflow-x-auto">
            {JSON.stringify(schema, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
