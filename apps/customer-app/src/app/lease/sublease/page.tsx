'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Alert, AlertDescription } from '@bossnyumba/design-system';

interface SubleaseRequest {
  readonly prospectName: string;
  readonly prospectEmail: string;
  readonly prospectPhone: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly proposedRent: number;
  readonly reason: string;
}

export default function SubleaseRequestPage(): React.ReactElement {
  const [form, setForm] = useState<SubleaseRequest>({
    prospectName: '',
    prospectEmail: '',
    prospectPhone: '',
    startDate: '',
    endDate: '',
    proposedRent: 0,
    reason: '',
  });
  const [message, setMessage] = useState<string | null>(null);

  const update = <K extends keyof SubleaseRequest>(k: K, v: SubleaseRequest[K]): void => {
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      // TODO: wire POST /api/customer/lease/sublease
      const res = await fetch('/api/customer/lease/sublease', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setMessage(res.ok ? 'Sublease request sent for owner approval.' : 'Submission failed.');
    } catch {
      setMessage('Submission failed.');
    }
  };

  return (
    <main className="p-6 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Request a sublease</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}

            <div>
              <Label htmlFor="name">Prospect name</Label>
              <Input id="name" value={form.prospectName} onChange={(e) => update('prospectName', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="email">Prospect email</Label>
                <Input id="email" type="email" value={form.prospectEmail} onChange={(e) => update('prospectEmail', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="phone">Prospect phone</Label>
                <Input id="phone" value={form.prospectPhone} onChange={(e) => update('prospectPhone', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="start">Start date</Label>
                <Input id="start" type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="end">End date</Label>
                <Input id="end" type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} required />
              </div>
            </div>
            <div>
              <Label htmlFor="rent">Proposed rent</Label>
              <Input id="rent" type="number" value={form.proposedRent} onChange={(e) => update('proposedRent', Number(e.target.value))} required />
            </div>
            <div>
              <Label htmlFor="reason">Reason for sublease</Label>
              <textarea
                id="reason"
                className="w-full border rounded-md p-2"
                rows={3}
                value={form.reason}
                onChange={(e) => update('reason', e.target.value)}
                required
              />
            </div>
            <Button type="submit">Submit request</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
