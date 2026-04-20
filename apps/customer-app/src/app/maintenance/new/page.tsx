/**
 * Maintenance request submission — Wave 15 UI gap closure.
 *
 * Posts to `/api/v1/cases` with photos attached as data URLs. The
 * tenantId stamp comes from the caller's JWT on the server side, never
 * from this form.
 */
'use client';

import { useState, useCallback } from 'react';
import { Camera, Send, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface PhotoItem {
  readonly id: string;
  readonly name: string;
  readonly dataUrl: string;
}

type Severity = 'low' | 'medium' | 'high' | 'critical' | 'emergency';

function apiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
  if (url?.trim()) {
    const base = url.trim().replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }
  return 'http://localhost:4001/api/v1';
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export default function NewMaintenancePage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('plumbing');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [photos, setPhotos] = useState<readonly PhotoItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const onFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const next: PhotoItem[] = [];
    for (const f of Array.from(files).slice(0, 5)) {
      try {
        next.push({
          id: crypto.randomUUID(),
          name: f.name,
          dataUrl: await readAsDataUrl(f),
        });
      } catch (err) {
        console.warn('photo read failed', err);
      }
    }
    setPhotos((prev) => [...prev, ...next].slice(0, 5));
  }, []);

  async function submit(): Promise<void> {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('customer_token') ?? ''
          : '';
      const res = await fetch(`${apiBase()}/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title,
          description,
          category,
          severity,
          photos: photos.map((p) => ({ name: p.name, dataUrl: p.dataUrl })),
        }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        data?: { id: string };
        error?: { message?: string };
      };
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Submission failed');
      }
      setSuccessId(body.data?.id ?? 'submitted');
      setTitle('');
      setDescription('');
      setPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Report Issue" showBack />
      <div className="px-4 py-4 pb-24 space-y-4">
        {successId && (
          <div className="rounded-lg bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 p-3 text-sm">
            Thanks — ticket submitted. Reference: {successId}.
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 p-3 text-sm">
            {error}
          </div>
        )}

        <label className="block text-sm text-gray-300">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kitchen sink leaking"
            className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white"
          />
        </label>

        <label className="block text-sm text-gray-300">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe the issue and when it started"
            className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-gray-300">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white"
            >
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="hvac">HVAC</option>
              <option value="appliance">Appliance</option>
              <option value="lighting">Lighting</option>
              <option value="general">General</option>
            </select>
          </label>
          <label className="block text-sm text-gray-300">
            Urgency
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-3 py-2 text-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
              <option value="emergency">Emergency</option>
            </select>
          </label>
        </div>

        <div>
          <label
            htmlFor="photo-input"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-800 border border-gray-700 px-4 py-2 text-sm text-gray-200 cursor-pointer"
          >
            <Camera className="h-4 w-4" /> Add photos ({photos.length}/5)
          </label>
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void onFiles(e.target.files)}
            className="hidden"
          />
          {photos.length > 0 && (
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {photos.map((p) => (
                <li key={p.id} className="relative">
                  <img
                    src={p.dataUrl}
                    alt={p.name}
                    className="rounded object-cover h-16 w-full"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((x) => x.id !== p.id))
                    }
                    className="absolute top-0 right-0 bg-black/70 rounded-bl p-0.5"
                    aria-label={`Remove ${p.name}`}
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !title.trim() || !description.trim()}
          className="w-full rounded-lg bg-blue-600 text-white py-3 font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Submitting…' : 'Submit ticket'}
        </button>
      </div>
    </>
  );
}
