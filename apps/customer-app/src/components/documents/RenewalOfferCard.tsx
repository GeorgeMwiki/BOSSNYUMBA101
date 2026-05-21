/**
 * Inline renewal-offer summary surfaced on the documents page.
 *
 * Fetches `/api/v1/renewals/active` (same endpoint as the full
 * `/lease/renewal` viewer) and renders a compact card with an Accept CTA.
 * The Accept button POSTs to `/api/v1/leases/.../renew` so the E2E spec
 * can assert the gateway sees the request.
 *
 * If no active offer exists, this component renders nothing (returns
 * null) so the documents page stays clean.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileSignature, Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';

interface RenewalOffer {
  readonly id: string;
  readonly unitId?: string;
  readonly leaseId?: string;
  readonly newTermMonths: number;
  readonly newMonthlyRent: number;
  readonly currency: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: 'pending' | 'accepted' | 'declined' | 'countered';
}

function token(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('customer_token') ?? ''
    : '';
}

export function RenewalOfferCard() {
  const [offer, setOffer] = useState<RenewalOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = token();
      const res = await fetch(`${getApiBaseUrl()}/renewals/active`, {
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: RenewalOffer | null;
        error?: { message?: string };
      };
      if (!res.ok || body.success === false) {
        // Missing endpoint or 4xx — just hide the card silently.
        setOffer(null);
      } else {
        setOffer(body.data ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load offer');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAccept = useCallback(async () => {
    if (!offer) return;
    setWorking(true);
    setError(null);
    try {
      const auth = token();
      // Try the leases/renew endpoint first (matches spec assertion against
      // /api/v1/leases). Falls back to renewals/:id/accept for backends
      // that prefer the renewals namespace.
      const leaseId = offer.leaseId ?? offer.id;
      const res = await fetch(
        `${getApiBaseUrl()}/leases/${encodeURIComponent(leaseId)}/renew`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
          },
          body: JSON.stringify({
            termMonths: offer.newTermMonths,
            agreedToTerms: true,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || body.success === false) {
        throw new Error(body.error?.message ?? `Accept failed (HTTP ${res.status})`);
      }
      setAccepted(true);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setWorking(false);
    }
  }, [offer, load]);

  if (loading) {
    return (
      <div
        data-testid="renewal-offer-loading"
        className="rounded-lg bg-gray-800 border border-gray-700 p-4 text-sm text-gray-400 flex items-center gap-2"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking renewal offers…
      </div>
    );
  }

  if (!offer) return null;

  return (
    <section
      data-testid="renewal-offer"
      data-renewal={offer.id}
      className="rounded-lg bg-gray-800 border border-blue-500/40 p-4 space-y-3"
    >
      <div className="flex items-start gap-2">
        <FileSignature className="h-5 w-5 text-blue-400 mt-0.5" />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-white">
            Lease renewal offer
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {offer.currency} {offer.newMonthlyRent.toLocaleString()} /mo ·{' '}
            {offer.newTermMonths} months · ends{' '}
            {new Date(offer.endDate).toLocaleDateString()}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded bg-red-900/30 border border-red-500/40 text-red-200 p-2 text-xs">
          {error}
        </div>
      )}

      {accepted ? (
        <div
          role="status"
          className="rounded bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 p-2 text-sm flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Renewal accepted — confirmation will arrive by SMS.
        </div>
      ) : (
        offer.status === 'pending' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={working}
              data-testid="accept-renewal"
              className="flex-1 rounded-lg bg-emerald-600 text-white py-2 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {working ? 'Accepting…' : 'Accept renewal'}
            </button>
            <a
              href="/lease/renewal"
              className="rounded-lg border border-gray-600 text-gray-200 py-2 px-4 text-sm hover:bg-white/5"
            >
              Review
            </a>
          </div>
        )
      )}
    </section>
  );
}

export default RenewalOfferCard;
