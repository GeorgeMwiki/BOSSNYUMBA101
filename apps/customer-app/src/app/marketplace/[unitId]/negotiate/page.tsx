'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Alert,
  AlertDescription,
  Skeleton,
} from '@bossnyumba/design-system';

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

const sendMessageSchema = z
  .object({
    text: z.string().default(''),
    offer: z.string().default(''),
  })
  .refine((v) => v.text.trim().length > 0 || v.offer.trim().length > 0, {
    message: 'Enter a message or offer',
    path: ['text'],
  })
  .refine(
    (v) => {
      if (!v.offer) return true;
      const n = Number(v.offer);
      return Number.isFinite(n) && n > 0;
    },
    { message: 'Offer must be a positive number.', path: ['offer'] }
  );

type SendMessageForm = z.infer<typeof sendMessageSchema>;

export default function NegotiatePage(): React.ReactElement {
  const params = useParams();
  const unitId = params?.unitId as string;

  const [unit, setUnit] = useState<UnitSummary | null>(null);
  const [messages, setMessages] = useState<ReadonlyArray<NegotiationMessage>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SendMessageForm>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { text: '', offer: '' },
    mode: 'onSubmit',
  });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadError(null);
      try {
        // TODO: wire /api/marketplace/:unitId and /api/marketplace/:unitId/negotiations
        const [u, m] = await Promise.all([
          fetch(`/api/marketplace/${unitId}`, { signal }),
          fetch(`/api/marketplace/${unitId}/negotiations`, { signal }),
        ]);
        if (!u.ok) throw new Error(`Unit request failed (${u.status})`);
        if (!m.ok) throw new Error(`Negotiations request failed (${m.status})`);
        if (!signal?.aborted) {
          setUnit((await u.json()) as UnitSummary);
          setMessages((await m.json()) as ReadonlyArray<NegotiationMessage>);
          setLoading(false);
        }
      } catch (err) {
        if (signal?.aborted) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load negotiation');
        setLoading(false);
      }
    },
    [unitId]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const onSubmit = handleSubmit(async (values) => {
    const parsedOffer = values.offer ? Number(values.offer) : undefined;
    const msg: NegotiationMessage = {
      id: crypto.randomUUID(),
      sender: 'customer',
      content: values.text.trim(),
      offerAmount: parsedOffer,
      sentAt: new Date().toISOString(),
    };
    // Optimistic immutable append.
    setMessages((prev) => [...prev, msg]);
    reset({ text: '', offer: '' });
    setSendError(null);
    try {
      // TODO: wire POST /api/marketplace/:unitId/negotiations
      const res = await fetch(`/api/marketplace/${unitId}/negotiations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
    } catch (err) {
      // Roll back optimistic update on failure.
      setMessages((prev) => prev.filter((x) => x.id !== msg.id));
      setSendError(err instanceof Error ? err.message : 'Failed to send message');
    }
  });

  return (
    <main className="p-6 max-w-3xl mx-auto flex flex-col h-[calc(100vh-3rem)]">
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{unit?.label ?? (loading ? 'Loading...' : 'Unit')}</CardTitle>
            {unit && (
              <div className="text-sm">
                Asking: <strong>{unit.askingRent.toLocaleString()}</strong> · Deposit {unit.depositRequired.toLocaleString()}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {loadError && (
        <Alert variant="danger" className="mb-2">
          <AlertDescription>
            {loadError}
            <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {sendError && (
        <Alert variant="danger" className="mb-2">
          <AlertDescription>{sendError}</AlertDescription>
        </Alert>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-2" aria-live="polite">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-64" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">
            No messages yet. Send the first one to open negotiation.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`p-2 rounded-md max-w-md ${m.sender === 'customer' ? 'bg-brand-100 ml-auto' : 'bg-muted'}`}
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
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="pt-2 border-t" noValidate>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Message..."
              aria-label="Negotiation message"
              aria-invalid={!!errors.text}
              {...register('text')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void onSubmit();
                }
              }}
            />
            {errors.text && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.text.message}
              </p>
            )}
          </div>
          <div className="w-32">
            <Input
              placeholder="Offer"
              type="number"
              aria-label="Offer amount"
              aria-invalid={!!errors.offer}
              {...register('offer')}
            />
            {errors.offer && (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.offer.message}
              </p>
            )}
          </div>
          <Button type="submit" loading={isSubmitting} disabled={isSubmitting} aria-label="Send message">
            Send
          </Button>
        </div>
      </form>
    </main>
  );
}
