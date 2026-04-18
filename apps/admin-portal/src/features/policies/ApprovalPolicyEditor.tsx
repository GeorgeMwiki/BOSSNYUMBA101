import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@bossnyumba/design-system';
import { Button, Input, Badge, Alert, AlertDescription } from '@bossnyumba/design-system';
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // TODO: Replace stub once GET /admin/approval-policies exists.
        const res = await api.get?.<ReadonlyArray<ApprovalPolicy>>(
          `/admin/approval-policies${tenantId ? `?tenantId=${tenantId}` : ''}`
        );
        if (!cancelled) {
          setPolicies(res?.data ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load policies');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Approval Policies</h1>
        <Button>+ New Policy</Button>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading policies...</p>
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
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button variant="destructive" size="sm">Disable</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {policies.length === 0 && (
            <p className="text-sm text-muted-foreground">No approval policies defined yet.</p>
          )}
        </div>
      )}

      {/* TODO: Add create/edit modal with form (name, entity type, drag-to-reorder stages). */}
      <div className="sr-only">
        <Input aria-hidden />
      </div>
    </div>
  );
};

export default ApprovalPolicyEditor;
