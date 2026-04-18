import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Alert, AlertDescription } from '@bossnyumba/design-system';
import { api } from '../../lib/api';

export interface GepgCredentials {
  readonly spCode: string;
  readonly spName: string;
  readonly signingCertPem: string;
  readonly signingKeyPem: string;
  readonly endpointUrl: string;
}

export const GepgCredentialsForm: React.FC = () => {
  const [form, setForm] = useState<GepgCredentials>({
    spCode: '',
    spName: '',
    signingCertPem: '',
    signingKeyPem: '',
    endpointUrl: '',
  });
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof GepgCredentials, value: string): void => {
    setForm((prev) => ({ ...prev, [key]: value })); // immutable update
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      // TODO: wire POST /admin/gepg/credentials (stores signingKey as secret reference).
      await api.post?.('/admin/gepg/credentials', form);
      setMessage('GePG credentials saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>GePG Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="danger"><AlertDescription>{error}</AlertDescription></Alert>}
          {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}

          <div>
            <Label htmlFor="spCode">SP Code</Label>
            <Input id="spCode" value={form.spCode} onChange={(e) => update('spCode', e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="spName">SP Name</Label>
            <Input id="spName" value={form.spName} onChange={(e) => update('spName', e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="endpointUrl">Endpoint URL</Label>
            <Input id="endpointUrl" type="url" value={form.endpointUrl} onChange={(e) => update('endpointUrl', e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="cert">Signing Certificate (PEM)</Label>
            <textarea
              id="cert"
              className="w-full border rounded-md p-2 font-mono text-xs"
              rows={6}
              value={form.signingCertPem}
              onChange={(e) => update('signingCertPem', e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="key">Signing Key (PEM) — stored as secret</Label>
            <textarea
              id="key"
              className="w-full border rounded-md p-2 font-mono text-xs"
              rows={6}
              value={form.signingKeyPem}
              onChange={(e) => update('signingKeyPem', e.target.value)}
              required
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save credentials'}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};

export default GepgCredentialsForm;
