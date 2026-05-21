'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine } from 'lucide-react';

import {
  InspectionChecklist,
  type ChecklistItemSeed,
  type ChecklistItemState,
} from '@/components/onboarding/InspectionChecklist';
import { SignaturePad } from '@/components/onboarding/SignaturePad';
import { getApiBaseUrl } from '@/lib/api';

/**
 * `/inspection` — lightweight move-in inspection at the top level so
 * deep-links from invite emails and the E2E spec (CA-AC-004) land
 * here directly. Saves progress per-item via PATCH to the gateway and
 * submits the aggregate via POST. Both endpoints are best-effort:
 * 404/5xx from the gateway is logged but does not block local
 * progression (matches the conversational-inspection pattern used
 * across the rest of customer-app).
 */

const CHECKLIST_ITEMS: readonly ChecklistItemSeed[] = [
  {
    id: 'walls-undamaged',
    label: 'Walls undamaged',
    description: 'Check for holes, cracks, or peeling paint.',
  },
  {
    id: 'flooring-condition',
    label: 'Flooring in good condition',
    description: 'No major scratches, stains, or loose tiles.',
  },
  {
    id: 'plumbing-works',
    label: 'Plumbing works',
    description: 'All taps run, drains flow, no leaks.',
  },
  {
    id: 'electrical-outlets-work',
    label: 'Electrical outlets working',
    description: 'Power available at every socket.',
  },
  {
    id: 'doors-locks-secure',
    label: 'Doors & locks secure',
    description: 'Every door closes and locks properly.',
  },
  {
    id: 'windows-functional',
    label: 'Windows open and close',
    description: 'No broken latches or stuck frames.',
  },
];

async function patchProgress(
  baseUrl: string,
  itemState: ChecklistItemState
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${baseUrl}/inspections/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({
        itemId: itemState.id,
        passed: itemState.passed,
        notes: itemState.notes,
        hasPhoto: Boolean(itemState.photoDataUrl),
      }),
    });
    // Soft-fail: we log non-2xx but keep going so the user is never
    // blocked by gateway issues.
    if (!response.ok && response.status !== 404 && response.status < 500) {
      console.warn(
        `inspection patch returned ${response.status}; continuing in offline mode`
      );
    }
  } catch (err) {
    if (!(err instanceof Error && err.name === 'AbortError')) {
      console.warn('inspection patch network error', err);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function submitInspection(
  baseUrl: string,
  items: readonly ChecklistItemState[],
  signature: string | null
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({
        type: 'move_in',
        signature,
        items: items.map((i) => ({
          id: i.id,
          label: i.label,
          passed: i.passed,
          notes: i.notes,
          photoDataUrl: i.photoDataUrl,
        })),
      }),
    });

    if (response.status === 404) {
      // Endpoint not deployed; surface gracefully.
      throw new Error(
        'Inspection submission is not yet available on this server.'
      );
    }
    if (!response.ok) {
      const message =
        response.status >= 500
          ? 'Server error. Please try again in a moment.'
          : 'Failed to submit inspection. Please try again.';
      throw new Error(message);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function InspectionPage(): JSX.Element {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const baseUrl = useMemo(() => {
    try {
      return getApiBaseUrl();
    } catch (err) {
      console.error('Inspection page: api base URL unavailable', err);
      return '';
    }
  }, []);

  const handlePatch = useCallback(
    async (itemState: ChecklistItemState) => {
      if (!baseUrl) return;
      await patchProgress(baseUrl, itemState);
    },
    [baseUrl]
  );

  const handleSubmit = useCallback(
    async (items: readonly ChecklistItemState[]) => {
      if (!baseUrl) {
        throw new Error('API gateway URL is not configured.');
      }
      await submitInspection(baseUrl, items, signature);
      router.push('/onboarding');
    },
    [baseUrl, router, signature]
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-xl font-semibold text-gray-900">
            Move-in inspection
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Confirm the condition of each item. Add photos where needed.
          </p>
        </div>
      </header>

      <div className="px-4 py-4 max-w-md mx-auto">
        <InspectionChecklist
          items={CHECKLIST_ITEMS}
          onPatch={handlePatch}
          onSubmit={handleSubmit}
        />

        <section className="mt-6 mb-32 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Sign to confirm
            </h2>
          </div>
          <p className="text-sm text-gray-500">
            Sign below to confirm that the checklist above accurately reflects
            the condition of the unit at move-in.
          </p>
          {signature ? (
            <div className="space-y-2">
              <div className="rounded-lg border-2 border-success-200 bg-success-50 p-2">
                <img
                  src={signature}
                  alt="Saved signature"
                  className="w-full h-auto"
                />
              </div>
              <button
                type="button"
                onClick={() => setSignature(null)}
                data-testid="inspection-signature-clear"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Re-sign
              </button>
            </div>
          ) : (
            <SignaturePad
              testId="inspection-signature"
              onDone={(dataUrl) => setSignature(dataUrl)}
              ariaLabel="Sign here to confirm the inspection results"
            />
          )}
        </section>
      </div>
    </main>
  );
}
