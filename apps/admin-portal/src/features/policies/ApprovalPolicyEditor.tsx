import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@bossnyumba/design-system';
import { Button, Badge, Alert, AlertDescription, Skeleton, EmptyState } from '@bossnyumba/design-system';
// TODO: Wire up shared API client once approval_policies endpoints exist.
import { api } from '../../lib/api';

/**
 * Approval Policy represents a configurable approval workflow
 * (e.g., "Lease termination requires Owner + Manager sign-off").
 * Shape from SCAFFOLDED_COMPLETION.md section 12.
 */
export interface ApprovalPolicy {
  readonly id: string;
  readonly name: string;
  readonly entityType: string; // e.g., 'lease_termination', 'damage_deduction'
  readonly stages: ReadonlyArray<{
    readonly order: number;
    readonly role: string;
    readonly slaHours: number;
  }>;
  readonly active: boolean;
}

interface Props {
  readonly tenantId?: string;
}

export const ApprovalPolicyEditor: React.FC<Props> = ({ tenantId }) => {
  const t = useTranslations('approvalPolicyEditor');
  const [policies, setPolicies] = useState<ReadonlyArray<ApprovalPolicy>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);

  const loadPolicies = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    setLoading(true);
    try {
      // TODO: Replace stub once GET /admin/approval-policies exists.
      const res = await api.get?.<ReadonlyArray<ApprovalPolicy>>(
        `/admin/approval-policies${tenantId ? `?tenantId=${tenantId}` : ''}`
      );
      if (!signal?.aborted) {
        setPolicies(res?.data ?? []);
        setLoading(false);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : t('errors.loadFailed'));
        setLoading(false);
      }
    }
  }, [tenantId, t]);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadPolicies(ctrl.signal);
    return () => ctrl.abort();
  }, [loadPolicies]);

  // Buttons are disabled with tooltips until backend endpoints land.
  const createUnavailableMsg = t('createUnavailable');
  const editUnavailableMsg = t('editUnavailable');

  const handleToggleActive = useCallback(async (policy: ApprovalPolicy) => {
    setPendingToggle(policy.id);
    setError(null);
    try {
      // Optimistic immutable update.
      setPolicies((prev) =>
        prev.map((p) => (p.id === policy.id ? { ...p, active: !p.active } : p))
      );
      await api.patch(`/admin/approval-policies/${policy.id}`, { active: !policy.active });
    } catch (err) {
      // Roll back on failure.
      setPolicies((prev) =>
        prev.map((p) => (p.id === policy.id ? { ...p, active: policy.active } : p))
      );
      setError(err instanceof Error ? err.message : t('errors.toggleFailed'));
    } finally {
      setPendingToggle(null);
    }
  }, [t]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button disabled title={createUnavailableMsg} aria-label={t('newPolicyAria')}>
          + {t('newPolicy')}
        </Button>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-4" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.description')}
        />
      ) : (
        <div className="grid gap-4">
          {policies.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  <Badge>{p.active ? t('status.active') : t('status.disabled')}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t('entityLabel', { entity: p.entityType })}</p>
                <ol className="mt-2 text-sm space-y-1">
                  {p.stages.map((s) => (
                    <li key={s.order}>
                      {t('stageLine', { order: s.order, role: s.role, sla: s.slaHours })}
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title={editUnavailableMsg}
                    aria-label={t('editUnavailableAria', { name: p.name })}
                  >
                    {t('edit')}
                  </Button>
                  <Button
                    variant={p.active ? 'destructive' : 'primary'}
                    size="sm"
                    loading={pendingToggle === p.id}
                    onClick={() => handleToggleActive(p)}
                    aria-label={p.active ? t('disableAria', { name: p.name }) : t('enableAria', { name: p.name })}
                  >
                    {p.active ? t('disable') : t('enable')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovalPolicyEditor;
