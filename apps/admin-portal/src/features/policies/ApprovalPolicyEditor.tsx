import React, { useCallback, useEffect, useState } from 'react';
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
        setError(err instanceof Error ? err.message : 'Failed to load policies');
        setLoading(false);
      }
    }
  }, [tenantId]);

  useEffect(() => {
    const ctrl = new AbortController();
    void loadPolicies(ctrl.signal);
    return () => ctrl.abort();
  }, [loadPolicies]);

  // Buttons are disabled with tooltips until backend endpoints land.
  const createUnavailableMsg = 'Create flow pending POST /admin/approval-policies';
  const editUnavailableMsg = 'Edit flow pending PATCH /admin/approval-policies/:id';

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
      setError(err instanceof Error ? err.message : 'Failed to toggle policy');
    } finally {
      setPendingToggle(null);
    }
  }, []);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Approval Policies</h1>
        <Button disabled title={createUnavailableMsg} aria-label="Create new policy (unavailable)">
          + New Policy
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
          title="No approval policies defined"
          description="Create an approval policy to define who signs off on sensitive operations."
        />
      ) : (
        <div className="grid gap-4">
          {policies.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  <Badge>{p.active ? 'Active' : 'Disabled'}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Entity: {p.entityType}</p>
                <ol className="mt-2 text-sm space-y-1">
                  {p.stages.map((s) => (
                    <li key={s.order}>
                      Stage {s.order}: {s.role} (SLA {s.slaHours}h)
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title={editUnavailableMsg}
                    aria-label={`Edit ${p.name} (unavailable)`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant={p.active ? 'destructive' : 'primary'}
                    size="sm"
                    loading={pendingToggle === p.id}
                    onClick={() => handleToggleActive(p)}
                    aria-label={`${p.active ? 'Disable' : 'Enable'} ${p.name}`}
                  >
                    {p.active ? 'Disable' : 'Enable'}
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
