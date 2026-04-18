'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@bossnyumba/design-system';

interface NegotiationMessage {
  readonly id: string;
  readonly sender: 'customer' | 'manager' | 'owner' | 'system';
  readonly content: string;
  readonly offerAmount?: number;
  readonly sentAt: string;
}

interface UnitSummary {
  readonly id: string;
  readonly label: string;
  readonly askingRent: number;
  readonly depositRequired: number;
}

export default function NegotiatePage(): React.ReactElement {
  const params = useParams();
  const unitId = params?.unitId as string;

  const [unit, setUnit] = useState<UnitSummary | null>(null);
  const [messages, setMessages] = useState<ReadonlyArray<NegotiationMessage>>([]);
  const [text, setText] = useState<string>('');
  const [offer, setOffer] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // TODO: wire /api/marketplace/:unitId and /api/marketplace/:unitId/negotiations
        const [u, m] = await Promise.all([
          fetch(`/api/marketplace/${unitId}`),
          fetch(`/api/marketplace/${unitId}/negotiations`),
        ]);
        if (!cancelled) {
          if (u.ok) setUnit((await u.json()) as UnitSummary);
          if (m.ok) setMessages((await m.json()) as ReadonlyArray<NegotiationMessage>);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (): Promise<void> => {
    if (!text.trim() && !offer) return;
    const parsedOffer = offer ? Number(offer) : undefined;
    const msg: NegotiationMessage = {
      id: crypto.randomUUID(),
      sender: 'customer',
      content: text.trim(),
      offerAmount: parsedOffer,
      sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    setText('');
    setOffer('');
    // TODO: wire POST /api/marketplace/:unitId/negotiations
    try {
      await fetch(`/api/marketplace/${unitId}/negotiations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      });
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="p-6 max-w-3xl mx-auto flex flex-col h-[calc(100vh-3rem)]">
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{unit?.label ?? 'Unit'}</CardTitle>
            {unit && (
              <div className="text-sm">
                Asking: <strong>{unit.askingRent.toLocaleString()}</strong> · Deposit{' '}
                {unit.depositRequired.toLocaleString()}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-2 rounded-md max-w-md ${
              m.sender === 'customer' ? 'bg-brand-100 ml-auto' : 'bg-muted'
            }`}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge>{m.sender}</Badge>
              <span>{new Date(m.sentAt).toLocaleTimeString()}</span>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap">{m.content}</p>
            {m.offerAmount !== undefined && (
              <p className="text-sm font-medium mt-1">Offer: {m.offerAmount.toLocaleString()}</p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <Input placeholder="Message..." value={text} onChange={(e) => setText(e.target.value)} />
        <Input
          placeholder="Offer"
          type="number"
          className="w-32"
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
        />
        <Button onClick={send}>Send</Button>
      </div>
    </main>
  );
}
