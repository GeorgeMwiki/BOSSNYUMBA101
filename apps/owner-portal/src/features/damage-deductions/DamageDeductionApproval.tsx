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

export interface DamageDeduction {
  readonly id: string;
  readonly leaseId: string;
  readonly tenantName: string;
  readonly unitLabel: string;
  readonly items: ReadonlyArray<{ readonly code: string; readonly description: string; readonly amount: number }>;
  readonly totalAmount: number;
  readonly depositOnHand: number;
  readonly status: 'pending_owner' | 'approved' | 'rejected' | 'counter_proposed';
  readonly evidenceUrls: ReadonlyArray<string>;
}

type DeductionDecision = 'approve' | 'reject';
type PendingDeduction = { readonly id: string; readonly decision: DeductionDecision };

export const DamageDeductionApproval: React.FC = () => {
  const t = useTranslations('damageDeductionApproval');
  const [items, setItems] = useState<ReadonlyArray<DamageDeduction>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDeduction | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire GET /owner/damage-deductions?status=pending_owner
      const res = await api.get?.<ReadonlyArray<DamageDeduction>>(
        '/owner/damage-deductions?status=pending_owner'
      );
      if (!signal?.aborted) {
        setItems(res?.data ?? []);
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

  const decide = useCallback(async (id: string, decision: DeductionDecision): Promise<void> => {
    setActError(null);
    setPending({ id, decision });
    try {
      // TODO: wire POST /owner/damage-deductions/:id/:decision
      await api.post?.(`/owner/damage-deductions/${id}/${decision}`, {});
      setItems((prev) => prev.filter((x) => x.id !== id)); // immutable
    } catch (err) {
      setActError(err instanceof Error ? err.message : `Failed to ${decision} deduction`);
    } finally {
      setPending(null);
    }
  }, []);

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
            <Skeleton key={i} className="h-64 w-full" />
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
            return (
              <Card key={d.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{d.unitLabel} — {d.tenantName}</CardTitle>
                    <Badge>{d.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm mb-3">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th scope="col">{t('item')}</th>
                        <th scope="col" className="text-right">{t('amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.items.map((i) => (
                        <tr key={i.code}>
                          <td>{i.description}</td>
                          <td className="text-right">{i.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="border-t font-medium">
                        <td>{t('totalProposed')}</td>
                        <td className="text-right">{d.totalAmount.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td>{t('depositOnHand')}</td>
                        <td className="text-right">{d.depositOnHand.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>

                  {d.evidenceUrls.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium">{t('evidence')}</h4>
                      <ul className="text-xs text-blue-600 list-disc pl-5">
                        {d.evidenceUrls.map((u) => (
                          <li key={u}>
                            <a href={u} target="_blank" rel="noreferrer">{u}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={isPending && pending?.decision === 'approve'}
                      disabled={isPending}
                      onClick={() => decide(d.id, 'approve')}
                      aria-label={t('approveAriaLabel', { unit: d.unitLabel })}
                    >
                      {t('approve')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      loading={isPending && pending?.decision === 'reject'}
                      disabled={isPending}
                      onClick={() => decide(d.id, 'reject')}
                      aria-label={t('rejectAriaLabel', { unit: d.unitLabel })}
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
