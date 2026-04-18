'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from '@bossnyumba/design-system';

interface Citation {
  readonly documentId: string;
  readonly documentTitle: string;
  readonly page: number;
  readonly snippet: string;
}

interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly citations: ReadonlyArray<Citation>;
}

export default function DocumentChatPage(): React.ReactElement {
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>([]);
  const [input, setInput] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const send = async (): Promise<void> => {
    if (!input.trim()) return;
    const question: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      citations: [],
    };
    setMessages((prev) => [...prev, question]); // immutable
    setInput('');
    setBusy(true);

    // TODO: wire /api/documents/chat (RAG endpoint returns content + citations[])
    try {
      const res = await fetch('/api/documents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question.content, history: messages }),
      });
      if (res.ok) {
        const reply = (await res.json()) as { content: string; citations: ReadonlyArray<Citation> };
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: reply.content, citations: reply.citations },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Request failed.', citations: [] },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="p-6 max-w-4xl mx-auto h-[calc(100vh-3rem)] flex flex-col">
      <h1 className="text-2xl font-semibold mb-2">Ask the documents</h1>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.map((m) => (
          <Card key={m.id} className={m.role === 'user' ? 'bg-brand-50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{m.role === 'user' ? 'You' : 'Assistant'}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              {m.citations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.citations.map((c, idx) => (
                    <div key={`${c.documentId}-${idx}`} className="text-xs border-l-2 border-brand-500 pl-2">
                      <div className="flex items-center gap-2">
                        <Badge>{c.documentTitle}</Badge>
                        <span className="text-muted-foreground">p. {c.page}</span>
                      </div>
                      <p className="text-muted-foreground italic">{c.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <Input
          placeholder="Ask about leases, inspections, policies..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button onClick={send} disabled={busy}>
          {busy ? 'Thinking...' : 'Send'}
        </Button>
      </div>
    </main>
  );
}
