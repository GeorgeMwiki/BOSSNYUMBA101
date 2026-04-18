import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Alert, AlertDescription } from '@bossnyumba/design-system';
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

export const DamageDeductionApproval: React.FC = () => {
  const [items, setItems] = useState<ReadonlyArray<DamageDeduction>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // TODO: wire GET /owner/damage-deductions?status=pending_owner
        const res = await api.get?.<ReadonlyArray<DamageDeduction>>('/owner/damage-deductions?status=pending_owner');
        if (!cancelled) {
          setItems(res?.data ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Load failed');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = async (id: string, decision: 'approve' | 'reject'): Promise<void> => {
    // TODO: wire POST /owner/damage-deductions/:id/:decision
    await api.post?.(`/owner/damage-deductions/${id}/${decision}`, {});
    setItems((prev) => prev.filter((x) => x.id !== id)); // immutable
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Damage Deduction Approvals</h1>
      {error && <Alert variant="danger"><AlertDescription>{error}</AlertDescription></Alert>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing pending your approval.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((d) => (
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
                      <th>Item</th>
                      <th className="text-right">Amount</th>
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
                      <td>Total proposed</td>
                      <td className="text-right">{d.totalAmount.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td>Deposit on hand</td>
                      <td className="text-right">{d.depositOnHand.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>

                {d.evidenceUrls.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium">Evidence</h4>
                    <ul className="text-xs text-blue-600 list-disc pl-5">
                      {d.evidenceUrls.map((u) => (
                        <li key={u}><a href={u} target="_blank" rel="noreferrer">{u}</a></li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(d.id, 'approve')}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => decide(d.id, 'reject')}>Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DamageDeductionApproval;
