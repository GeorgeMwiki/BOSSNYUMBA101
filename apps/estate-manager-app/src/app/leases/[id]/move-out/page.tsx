'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge, Alert, AlertDescription } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';

interface MoveOutItem {
  readonly id: string;
  readonly description: string;
  readonly amount: number;
}

export default function LeaseMoveOutPage(): React.ReactElement {
  const t = useTranslations('leaseMoveOut');
  const params = useParams();
  const id = params?.id as string;
  const [items, setItems] = useState<ReadonlyArray<MoveOutItem>>([]);
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const addItem = (): void => {
    if (!description.trim() || !amount.trim()) {
      setError(t('descAmountRequired'));
      return;
    }
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError(t('amountNonNegative'));
      return;
    }
    setError(null);
    // immutable update
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: description.trim(), amount: parsed },
    ]);
    setDescription('');
    setAmount('');
  };

  const submit = async (): Promise<void> => {
    // TODO: wire POST /api/leases/:id/move-out { items }
    try {
      await fetch(`/api/leases/${id}/move-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
    } catch {
      setError(t('submissionFailed'));
    }
  };

  const total = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <main className="p-6 max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">{t('title', { id })}</h1>

      {error && <Alert variant="danger"><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[1fr_140px_100px] gap-2 items-end mb-3">
            <div>
              <Label htmlFor="desc">{t('description')}</Label>
              <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="amt">{t('amount')}</Label>
              <Input id="amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <Button onClick={addItem}>{t('add')}</Button>
          </div>

          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.id} className="py-2 flex justify-between">
                <span className="text-sm">{i.description}</span>
                <Badge>{i.amount.toLocaleString()}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium">{t('total', { amount: total.toLocaleString() })}</p>

          <Button className="mt-4" onClick={submit} disabled={items.length === 0}>
            {t('submitForApproval')}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
