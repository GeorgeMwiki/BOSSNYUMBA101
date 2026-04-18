'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge } from '@bossnyumba/design-system';

interface RenewalProposal {
  readonly leaseId: string;
  readonly currentRent: number;
  readonly proposedRent: number;
  readonly renewalTermMonths: number;
  readonly tenantAcceptance: 'pending' | 'accepted' | 'rejected' | 'countered';
  readonly expiryDate: string;
}

export default function LeaseRenewalPage(): React.ReactElement {
  const params = useParams();
  const id = params?.id as string;
  const [data, setData] = useState<RenewalProposal | null>(null);
  const [proposedRent, setProposedRent] = useState<string>('');
  const [termMonths, setTermMonths] = useState<string>('12');

  useEffect(() => {
    // TODO: wire GET /api/leases/:id/renewal endpoint
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leases/${id}/renewal`);
        if (!cancelled && res.ok) {
          const d = (await res.json()) as RenewalProposal;
          setData(d);
          setProposedRent(String(d.proposedRent));
          setTermMonths(String(d.renewalTermMonths));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const submit = async (): Promise<void> => {
    // TODO: wire POST /api/leases/:id/renewal
    await fetch(`/api/leases/${id}/renewal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposedRent: Number(proposedRent), termMonths: Number(termMonths) }),
    }).catch(() => {});
  };

  return (
    <main className="p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Lease Renewal — {id}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data ? (
            <>
              <p className="text-sm">
                Current rent: <strong>{data.currentRent.toLocaleString()}</strong>
              </p>
              <p className="text-sm">
                Lease expires: {new Date(data.expiryDate).toLocaleDateString()}
              </p>
              <p className="text-sm">
                Tenant acceptance: <Badge>{data.tenantAcceptance}</Badge>
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading lease data...</p>
          )}

          <div>
            <Label htmlFor="rent">Proposed rent</Label>
            <Input
              id="rent"
              type="number"
              value={proposedRent}
              onChange={(e) => setProposedRent(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="term">Renewal term (months)</Label>
            <Input
              id="term"
              type="number"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
            />
          </div>
          <Button onClick={submit}>Send proposal to tenant</Button>
        </CardContent>
      </Card>
    </main>
  );
}
