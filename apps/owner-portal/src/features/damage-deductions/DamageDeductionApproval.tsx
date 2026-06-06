import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Alert,
  AlertDescription,
  Skeleton,
  EmptyState,
} from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { api } from '../../lib/api';
import { useTenantCurrencyFormatter } from '../../hooks/useTenantCurrency';

/**
 * Real damage-deduction claim, mirroring the `DamageDeductionCase`
 * returned by the gateway `GET /damage-deductions/open` endpoint
 * (services/domain-services damage-deduction repo). Only fields the
 * backend actually persists are modelled — the previous interface
 * required `items[]` / `depositOnHand` / `evidenceUrls` / `tenantName`
 * which the service does NOT provide, so they have been dropped rather
 * than synthesised.
 */
export interface DamageClaim {
  readonly id: string;
  readonly leaseId?: string;
  readonly caseId?: string;
  readonly claimedDeductionMinor: number;
  readonly proposedDeductionMinor?: number;
  readonly tenantCounterProposalMinor?: number;
  readonly currency: string;
  readonly status:
    | 'claim_filed'
    | 'tenant_responded'
    | 'negotiating'
    | 'escalated'
    | 'agreed'
    | string;
  readonly evidenceBundleId?: string;
  readonly createdAt: string;
}

type DeductionDecision = 'approve' | 'reject';
type PendingDeduction = { readonly id: string; readonly decision: DeductionDecision };

export const DamageDeductionApproval: React.FC = () => {
  const t = useTranslations('damageDeductionApproval');
  const { format: formatTenantCurrency } = useTenantCurrencyFormatter();
  const [items, setItems] = useState<ReadonlyArray<DamageClaim>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDeduction | null>(null);

  // Each claim carries its own ISO-4217 code; prefer it so a claim raised
  // in a different currency renders correctly. Fall back to the tenant
  // formatter (which renders '—' when the chain is empty) otherwise.
  const money = useCallback(
    (amountMinor: number, currency?: string): string => {
      if (currency) {
        return new Intl.NumberFormat('en', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amountMinor);
      }
      return formatTenantCurrency(amountMinor);
    },
    [formatTenantCurrency],
  );

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // Real, working endpoint. `/owner/damage-deductions` 404s — the
      // damage-deduction router is mounted at `/damage-deductions`, and
      // `/open` is the route that returns live claims (the bare `/` route
      // intentionally returns an empty list pointing here).
      const res = await api.get<ReadonlyArray<DamageClaim>>(
        '/damage-deductions/open'
      );
      if (!signal?.aborted) {
        if (!res.success) {
          setError(res.error?.message ?? 'Load failed');
          setLoading(false);
          return;
        }
        setItems(res.data ?? []);
        setLoading(false);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : 'Load failed');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const decide = useCallback(
    async (claim: DamageClaim, decision: DeductionDecision): Promise<void> => {
      setActError(null);
      setPending({ id: claim.id, decision });
      try {
        // The real settlement endpoint is `/damage-deductions/:id/settle`
        // (there is no `/approve` or `/reject`). Owner approval settles at
        // the proposed (or claimed) amount; rejection settles at zero so
        // the deposit is returned in full. `agreedAmountMinor` is the real
        // contract field the SettleSchema validates.
        const agreedAmountMinor =
          decision === 'approve'
            ? claim.proposedDeductionMinor ?? claim.claimedDeductionMinor
            : 0;
        const res = await api.post(`/damage-deductions/${claim.id}/settle`, {
          agreedAmountMinor,
        });
        if (!res.success) {
          setActError(res.error?.message ?? `Failed to ${decision} deduction`);
          return;
        }
        setItems((prev) => prev.filter((x) => x.id !== claim.id)); // immutable
      } catch (err) {
        setActError(err instanceof Error ? err.message : `Failed to ${decision} deduction`);
      } finally {
        setPending(null);
      }
    },
    [],
  );

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      {error && (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {actError && (
        <Alert variant="danger">
          <AlertDescription>{actError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-3" aria-live="polite">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="grid gap-3">
          {items.map((d) => {
            const isPending = pending?.id === d.id;
            const proposed = d.proposedDeductionMinor ?? d.claimedDeductionMinor;
            return (
              <Card key={d.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{d.caseId ?? d.leaseId ?? d.id}</CardTitle>
                    <Badge>{d.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm mb-3">
                    <tbody>
                      <tr>
                        <td className="text-muted-foreground">{t('claimedAmount')}</td>
                        <td className="text-right">{money(d.claimedDeductionMinor, d.currency)}</td>
                      </tr>
                      {d.tenantCounterProposalMinor != null && (
                        <tr>
                          <td className="text-muted-foreground">{t('tenantCounter')}</td>
                          <td className="text-right">
                            {money(d.tenantCounterProposalMinor, d.currency)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t font-medium">
                        <td>{t('settlementAmount')}</td>
                        <td className="text-right">{money(proposed, d.currency)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={isPending && pending?.decision === 'approve'}
                      disabled={isPending}
                      onClick={() => decide(d, 'approve')}
                      aria-label={t('approveAriaLabel', { unit: d.caseId ?? d.id })}
                    >
                      {t('approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      loading={isPending && pending?.decision === 'reject'}
                      disabled={isPending}
                      onClick={() => decide(d, 'reject')}
                      aria-label={t('rejectAriaLabel', { unit: d.caseId ?? d.id })}
                    >
                      {t('reject')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DamageDeductionApproval;
