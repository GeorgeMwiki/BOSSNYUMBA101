'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Alert, AlertDescription } from '@bossnyumba/design-system';

interface DamageLineItem {
  readonly id: string;
  readonly description: string;
  readonly managerAmount: number;
  readonly tenantCounterAmount?: number;
  readonly tenantNote?: string;
}

interface DamageProposal {
  readonly id: string;
  readonly leaseId: string;
  readonly items: ReadonlyArray<DamageLineItem>;
  readonly totalProposed: number;
  readonly depositOnHand: number;
}

export default function DamageDisputesPage(): React.ReactElement {
  const [proposal, setProposal] = useState<DamageProposal | null>(null);
  const [counters, setCounters] = useState<Record<string, { amount?: number; note?: string }>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // TODO: wire GET /api/customer/lease/move-out/disputes (current active proposal)
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/customer/lease/move-out/disputes');
        if (!cancelled && res.ok) setProposal((await res.json()) as DamageProposal);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateCounter = (itemId: string, patch: { amount?: number; note?: string }): void => {
    setCounters((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  };

  const submit = async (): Promise<void> => {
    if (!proposal) return;
    setSubmitting(true);
    try {
      // TODO: wire POST /api/customer/lease/move-out/disputes
      const res = await fetch('/api/customer/lease/move-out/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, counters }),
      });
      setMessage(res.ok ? 'Counter submitted.' : 'Submission failed.');
    } catch {
      setMessage('Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!proposal) {
    return (
      <main className="p-6">
        <p className="text-sm text-muted-foreground">No active damage proposal to dispute.</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Damage proposal — counter / dispute</h1>
      {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}

      <Card>
        <CardHeader>
          <CardTitle>
            Proposed {proposal.totalProposed.toLocaleString()} · Deposit held {proposal.depositOnHand.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposal.items.map((i) => (
            <div key={i.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{i.description}</span>
                <Badge>Manager: {i.managerAmount.toLocaleString()}</Badge>
              </div>
              <div className="grid grid-cols-[140px_1fr] gap-2 mt-2">
                <Input
                  type="number"
                  placeholder="Your amount"
                  onChange={(e) => updateCounter(i.id, { amount: Number(e.target.value) })}
                />
                <Input
                  placeholder="Your note / evidence..."
                  onChange={(e) => updateCounter(i.id, { note: e.target.value })}
                />
              </div>
            </div>
          ))}

          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit counter'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
