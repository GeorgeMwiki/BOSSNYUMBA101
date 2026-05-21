'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, Check, X } from 'lucide-react';

/**
 * InspectionChecklist — flat, minimal move-in inspection surface.
 *
 * Lists checklist items (e.g. "Walls undamaged", "Plumbing works"). For
 * each: pass/fail checkbox, optional photo upload, and a notes field.
 * Saves progress on every interaction via the supplied `onPatch`
 * callback (called per-item). Aggregates results and submits via the
 * supplied `onSubmit` callback when the user taps the sticky CTA.
 *
 * The richer room-by-room flow at `/onboarding/inspection` remains the
 * canonical move-in inspection page. This component is the lightweight
 * affordance mounted at `/inspection` so external links + the E2E spec
 * (CA-AC-004) have a stable surface.
 */

export interface ChecklistItemSeed {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface ChecklistItemState extends ChecklistItemSeed {
  readonly passed: boolean | null;
  readonly notes: string;
  readonly photoDataUrl: string | null;
}

interface InspectionChecklistProps {
  items: readonly ChecklistItemSeed[];
  onPatch?: (state: ChecklistItemState) => void | Promise<void>;
  onSubmit: (
    state: readonly ChecklistItemState[]
  ) => void | Promise<void>;
  submitLabel?: string;
}

const seedToState = (s: ChecklistItemSeed): ChecklistItemState => ({
  ...s,
  passed: null,
  notes: '',
  photoDataUrl: null,
});

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function InspectionChecklist({
  items,
  onPatch,
  onSubmit,
  submitLabel = 'Submit inspection',
}: InspectionChecklistProps): JSX.Element {
  const [state, setState] = useState<readonly ChecklistItemState[]>(
    () => items.map(seedToState)
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // If parent items change identity, reset.
    setState((prev) =>
      items.map(
        (i) => prev.find((p) => p.id === i.id) ?? seedToState(i)
      )
    );
  }, [items]);

  const updateItem = useCallback(
    (id: string, patch: Partial<ChecklistItemState>) => {
      let next: ChecklistItemState | undefined;
      setState((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          next = { ...item, ...patch };
          return next;
        })
      );
      if (next && onPatch) {
        // Fire-and-forget; the parent is responsible for error handling.
        Promise.resolve(onPatch(next)).catch((err) => {
          console.error('InspectionChecklist onPatch failed', err);
        });
      }
    },
    [onPatch]
  );

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(state);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Submit failed. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, state]);

  const answeredCount = state.filter((s) => s.passed !== null).length;
  const canSubmit = answeredCount === state.length && !submitting;

  return (
    <>
      <div
        data-testid="inspection-checklist"
        data-checklist="true"
        className="space-y-3 pb-32"
        role="list"
        aria-label="Inspection checklist items"
      >
        {state.map((item, idx) => (
          <div
            key={item.id}
            role="listitem"
            data-testid={`inspection-item-${item.id}`}
            className="rounded-xl border border-gray-200 bg-white p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 flex-shrink-0">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">
                  {item.label}
                </div>
                {item.description ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex gap-2" role="group" aria-label={`${item.label} condition`}>
              <button
                type="button"
                onClick={() => updateItem(item.id, { passed: true })}
                aria-pressed={item.passed === true}
                data-testid={`inspection-item-${item.id}-pass`}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  item.passed === true
                    ? 'bg-success-600 text-white'
                    : 'bg-success-50 text-success-700 hover:bg-success-100'
                }`}
              >
                <Check className="w-4 h-4" />
                Pass
              </button>
              <button
                type="button"
                onClick={() => updateItem(item.id, { passed: false })}
                aria-pressed={item.passed === false}
                data-testid={`inspection-item-${item.id}-fail`}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  item.passed === false
                    ? 'bg-danger-600 text-white'
                    : 'bg-danger-50 text-danger-700 hover:bg-danger-100'
                }`}
              >
                <X className="w-4 h-4" />
                Fail
              </button>
            </div>

            {/* Photo upload */}
            <label
              htmlFor={`photo-${item.id}`}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              {item.photoDataUrl ? 'Replace photo' : 'Attach photo'}
              <input
                id={`photo-${item.id}`}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                data-testid={`inspection-item-${item.id}-photo`}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const dataUrl = await fileToDataUrl(file);
                    updateItem(item.id, { photoDataUrl: dataUrl });
                  } catch (err) {
                    console.error('Failed to read photo', err);
                  } finally {
                    // Allow reselecting the same file.
                    e.target.value = '';
                  }
                }}
              />
            </label>
            {item.photoDataUrl ? (
              <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={item.photoDataUrl}
                  alt={`${item.label} photo`}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}

            <textarea
              placeholder="Notes (optional)"
              value={item.notes}
              onChange={(e) =>
                updateItem(item.id, { notes: e.target.value })
              }
              data-testid={`inspection-item-${item.id}-notes`}
              aria-label={`${item.label} notes`}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
              rows={2}
            />
          </div>
        ))}
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 space-y-2">
        {submitError ? (
          <p
            role="alert"
            data-testid="inspection-submit-error"
            className="text-sm text-danger-600"
          >
            {submitError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          data-testid="inspection-submit-button"
          aria-label="Submit inspection"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-4 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            submitLabel
          )}
        </button>
        <p className="text-center text-xs text-gray-500">
          {answeredCount} of {state.length} items answered
        </p>
      </div>
    </>
  );
}

export default InspectionChecklist;
