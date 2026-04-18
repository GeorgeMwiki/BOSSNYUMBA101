'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Alert, AlertDescription } from '@bossnyumba/design-system';

type LetterType = 'proof_of_residence' | 'rent_statement' | 'no_objection' | 'reference' | 'custom';

interface LetterRequest {
  readonly type: LetterType;
  readonly recipientName: string;
  readonly reason: string;
  readonly customText?: string;
}

export default function RequestLetterPage(): React.ReactElement {
  const [form, setForm] = useState<LetterRequest>({
    type: 'proof_of_residence',
    recipientName: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = <K extends keyof LetterRequest>(k: K, v: LetterRequest[K]): void => {
    setForm((prev) => ({ ...prev, [k]: v })); // immutable
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // TODO: wire /api/customer/requests/letters
      const res = await fetch('/api/customer/requests/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) setMessage('Letter request submitted. You will be notified when ready.');
      else setMessage('Submission failed.');
    } catch {
      setMessage('Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="p-6 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Request a letter</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}

            <div>
              <Label htmlFor="type">Letter type</Label>
              <select
                id="type"
                className="w-full border rounded-md p-2"
                value={form.type}
                onChange={(e) => update('type', e.target.value as LetterType)}
              >
                <option value="proof_of_residence">Proof of residence</option>
                <option value="rent_statement">Rent statement</option>
                <option value="no_objection">No-objection letter</option>
                <option value="reference">Reference letter</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <Label htmlFor="recipient">Addressed to</Label>
              <Input
                id="recipient"
                value={form.recipientName}
                onChange={(e) => update('recipientName', e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <textarea
                id="reason"
                className="w-full border rounded-md p-2"
                rows={3}
                value={form.reason}
                onChange={(e) => update('reason', e.target.value)}
                required
              />
            </div>

            {form.type === 'custom' && (
              <div>
                <Label htmlFor="custom">Custom text</Label>
                <textarea
                  id="custom"
                  className="w-full border rounded-md p-2"
                  rows={4}
                  value={form.customText ?? ''}
                  onChange={(e) => update('customText', e.target.value)}
                />
              </div>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
