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

export interface Negotiation {
  readonly id: string;
  readonly unitId: string;
  readonly unitLabel: string;
  readonly customerName: string;
  readonly proposedRent: number;
  readonly askingRent: number;
  readonly status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'expired';
  readonly lastMessageAt: string;
}

type NegotiationAction = 'accept' | 'override' | 'reject';
type PendingAction = { readonly id: string; readonly action: NegotiationAction };

export const NegotiationsList: React.FC = () => {
  const t = useTranslations('negotiationsList');
  const [items, setItems] = useState<ReadonlyArray<Negotiation>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire GET /owner/negotiations endpoint.
      const res = await api.get?.<ReadonlyArray<Negotiation>>('/owner/negotiations');
      if (!signal?.aborted) {
        setItems(res?.data ?? []);
        setLoading(false);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const act = useCallback(async (id: string, action: NegotiationAction): Promise<void> => {
    setActError(null);
    setPending({ id, action });
    try {
      // TODO: wire POST /owner/negotiations/:id/:action
      await api.post?.(`/owner/negotiations/${id}/${action}`, {});
      // Immutable removal of resolved row.
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setActError(err instanceof Error ? err.message : `Failed to ${action} negotiation`);
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
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="grid gap-3">
          {items.map((n) => {
            const isPending = pending?.id === n.id;
            return (
              <Card key={n.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{n.unitLabel}</CardTitle>
                    <Badge>{n.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{t('prospect')}: <span className="font-medium">{n.customerName}</span></p>
                  <p className="text-sm">
                    {t('proposed')}: <strong>{n.proposedRent.toLocaleString()}</strong> {t('vsAsking')}{' '}
                    {n.askingRent.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('lastMessage')}: {new Date(n.lastMessageAt).toLocaleString()}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      loading={isPending && pending?.action === 'accept'}
                      disabled={isPending}
                      onClick={() => act(n.id, 'accept')}
                      aria-label={t('acceptAriaLabel', { unit: n.unitLabel })}
                    >
                      {t('accept')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={isPending && pending?.action === 'override'}
                      disabled={isPending}
                      onClick={() => act(n.id, 'override')}
                      aria-label={t('overrideAriaLabel', { unit: n.unitLabel })}
                    >
                      {t('override')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      loading={isPending && pending?.action === 'reject'}
                      disabled={isPending}
                      onClick={() => act(n.id, 'reject')}
                      aria-label={t('rejectAriaLabel', { unit: n.unitLabel })}
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

export default NegotiationsList;
