'use client';

/**
 * MaintenanceTicketModal — "Report an issue" form, mounted from the
 * sticky CTA on the maintenance list.
 *
 * Fields:
 *   - category (select)
 *   - description (textarea)
 *   - photo upload (file input, image/*)
 *   - severity slider (low → emergency)
 *
 * POSTs to `/api/v1/maintenance/tickets`. On success the modal shows
 * the returned ticket id + SLA estimate, then closes after a short
 * delay. The parent receives the new ticket via `onCreated` so it can
 * append to the list without re-fetching.
 *
 * Accessibility:
 *   - Modal traps focus, restores focus on close, ESC-closes.
 *   - Each field labelled by an associated `<label htmlFor>`.
 *   - The submit button is disabled until description is non-empty.
 *
 * All interactive elements carry `data-testid` matching the E2E
 * locators in `e2e/page-objects/CustomerAppPage.ts`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Modal } from '@bossnyumba/design-system';
import { getApiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';

const SEVERITY_VALUES = ['low', 'medium', 'high', 'critical', 'emergency'] as const;
type Severity = (typeof SEVERITY_VALUES)[number];

const CATEGORIES: ReadonlyArray<{ readonly value: string; readonly label: string }> = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'pest', label: 'Pest control' },
  { value: 'general', label: 'General' },
];

const SEVERITY_LABELS: Readonly<Record<Severity, string>> = {
  low: 'Low — when convenient',
  medium: 'Medium — within a week',
  high: 'High — within 24 h',
  critical: 'Critical — same day',
  emergency: 'Emergency — now',
};

const PHOTO_LIMIT = 5;

export interface CreatedTicket {
  readonly id: string;
  readonly etaHours?: number;
}

export interface MaintenanceTicketModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated?: (ticket: CreatedTicket) => void;
}

interface Photo {
  readonly id: string;
  readonly name: string;
  readonly dataUrl: string;
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('photo read failed'));
    reader.readAsDataURL(file);
  });
}

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('customer_token') ?? '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function MaintenanceTicketModal({
  open,
  onClose,
  onCreated,
}: MaintenanceTicketModalProps): JSX.Element {
  const [category, setCategory] = useState<string>('plumbing');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [photos, setPhotos] = useState<ReadonlyArray<Photo>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [createdEta, setCreatedEta] = useState<number | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  // Capture the previously-focused element so we can restore focus on
  // close. The Modal component already focuses the first focusable
  // child; we own the *restoration* on close.
  useEffect(() => {
    if (open) {
      lastTriggerRef.current = document.activeElement as HTMLElement | null;
    } else if (lastTriggerRef.current) {
      lastTriggerRef.current.focus?.();
    }
  }, [open]);

  // Reset form whenever the modal opens (immutability across opens).
  useEffect(() => {
    if (open) {
      setCategory('plumbing');
      setDescription('');
      setSeverity('medium');
      setPhotos([]);
      setError(null);
      setCreatedId(null);
      setCreatedEta(null);
    }
  }, [open]);

  const onPickPhotos = useCallback(
    async (files: FileList | null): Promise<void> => {
      if (!files || files.length === 0) return;
      const next: Photo[] = [];
      for (const f of Array.from(files).slice(0, PHOTO_LIMIT)) {
        try {
          next.push({
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: f.name,
            dataUrl: await readAsDataUrl(f),
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'photo read failed');
        }
      }
      setPhotos((prev) => [...prev, ...next].slice(0, PHOTO_LIMIT));
    },
    [],
  );

  const removePhoto = useCallback((id: string): void => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      const trimmed = description.trim();
      if (!trimmed) {
        setError('Please describe the issue.');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`${getApiBaseUrl()}/maintenance/tickets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeader(),
            ...getCsrfHeaders(),
          },
          body: JSON.stringify({
            category,
            description: trimmed,
            severity,
            photos: photos.map((p) => ({ name: p.name, dataUrl: p.dataUrl })),
          }),
        });
        if (!res.ok) {
          throw new Error(`Ticket create failed (${res.status})`);
        }
        const body = (await res.json()) as {
          data?: { id?: string; etaHours?: number };
        };
        const id = body.data?.id ?? null;
        const eta = body.data?.etaHours ?? null;
        if (!id) {
          throw new Error('Gateway returned no ticket id.');
        }
        setCreatedId(id);
        setCreatedEta(eta);
        onCreated?.({ id, ...(typeof eta === 'number' ? { etaHours: eta } : {}) });
        // Hold the success view for 2s, then close.
        setTimeout(() => onClose(), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Submission failed');
      } finally {
        setSubmitting(false);
      }
    },
    [category, description, severity, photos, onCreated, onClose],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={createdId ? 'Ticket received' : 'Report an issue'}
      description={
        createdId
          ? `Your reference is ${createdId}.`
          : 'Tell us what is wrong and we will dispatch help.'
      }
      size="md"
      closeOnEscape={!submitting}
      closeOnOverlayClick={!submitting}
    >
      <div data-testid="maintenance-ticket-modal">
        {createdId ? (
          <div className="space-y-4 text-sm text-foreground">
            <p>
              Thanks — your ticket <span className="font-semibold">{createdId}</span>{' '}
              has been received.
            </p>
            {typeof createdEta === 'number' ? (
              <p className="text-muted-foreground" data-testid="sla-estimate" data-sla>
                Estimated response:{' '}
                <span className="text-foreground">{createdEta} h</span>
              </p>
            ) : null}
          </div>
        ) : (
          <form
            onSubmit={(e) => void onSubmit(e)}
            data-testid="maintenance-ticket-form"
            className="space-y-4 text-left"
          >
            {error ? (
              <div
                role="alert"
                className="rounded-md bg-red-500/10 border border-red-500/40 text-red-400 px-3 py-2 text-sm"
              >
                {error}
              </div>
            ) : null}

            <label className="block text-sm">
              <span className="block text-muted-foreground mb-1">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="ticket-category"
                className="block w-full rounded-md border border-border bg-card px-3 py-2 text-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="ticket-description" className="block text-sm">
              <span className="block text-muted-foreground mb-1">Description</span>
              <textarea
                id="ticket-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what is happening — when it started, where in your unit, anything else useful."
                rows={4}
                aria-label="Description"
                data-testid="ticket-description"
                className="block w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                required
              />
            </label>

            <div>
              <span className="block text-sm text-muted-foreground mb-2">
                Severity:{' '}
                <span className="text-foreground">{SEVERITY_LABELS[severity]}</span>
              </span>
              <input
                type="range"
                min={0}
                max={SEVERITY_VALUES.length - 1}
                step={1}
                value={SEVERITY_VALUES.indexOf(severity)}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setSeverity(SEVERITY_VALUES[idx] ?? 'medium');
                }}
                aria-label="Severity"
                data-testid="ticket-severity"
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="ticket-photo"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground cursor-pointer"
              >
                <Camera className="h-4 w-4" /> Add photos ({photos.length}/{PHOTO_LIMIT})
              </label>
              <input
                id="ticket-photo"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void onPickPhotos(e.target.files)}
                aria-label="Photo"
                data-testid="ticket-photo"
                className="sr-only"
              />
              {photos.length > 0 ? (
                <ul className="mt-3 grid grid-cols-5 gap-2">
                  {photos.map((p) => (
                    <li key={p.id} className="relative">
                      <img
                        src={p.dataUrl}
                        alt={p.name}
                        className="h-16 w-full rounded object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        aria-label={`Remove ${p.name}`}
                        className="absolute right-0 top-0 rounded-bl bg-black/70 p-0.5"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || description.trim().length === 0}
                data-testid="submit-ticket"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
