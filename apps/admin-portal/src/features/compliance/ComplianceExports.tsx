import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@bossnyumba/design-system';
import { api } from '../../lib/api';

export interface ComplianceExport {
  readonly id: string;
  readonly type: 'kra_itax' | 'nssf' | 'nhif' | 'gepg' | 'audit_log';
  readonly period: string; // e.g. '2026-03'
  readonly status: 'queued' | 'generating' | 'ready' | 'failed';
  readonly downloadUrl?: string;
  readonly createdAt: string;
}

export const ComplianceExports: React.FC = () => {
  const [exports, setExports] = useState<ReadonlyArray<ComplianceExport>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // TODO: wire GET /admin/compliance/exports endpoint.
      const res = await api.get?.<ReadonlyArray<ComplianceExport>>('/admin/compliance/exports');
      if (!cancelled) {
        setExports(res?.data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduleExport = async (type: ComplianceExport['type']): Promise<void> => {
    // TODO: wire POST /admin/compliance/exports { type, period } endpoint.
    try {
      await api.post?.('/admin/compliance/exports', { type });
    } catch (err) {
      console.error('Schedule export failed', err);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Compliance Exports</h1>

      <Card>
        <CardHeader>
          <CardTitle>Schedule new export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => scheduleExport('kra_itax')}>KRA iTax</Button>
          <Button onClick={() => scheduleExport('nssf')}>NSSF</Button>
          <Button onClick={() => scheduleExport('nhif')}>NHIF</Button>
          <Button onClick={() => scheduleExport('gepg')}>GePG</Button>
          <Button variant="outline" onClick={() => scheduleExport('audit_log')}>Audit log</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent exports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <ul className="divide-y">
              {exports.map((e) => (
                <li key={e.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{e.type.toUpperCase()} — {e.period}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{e.status}</Badge>
                    {e.status === 'ready' && e.downloadUrl && (
                      <a href={e.downloadUrl} download>
                        <Button size="sm">Download</Button>
                      </a>
                    )}
                  </div>
                </li>
              ))}
              {exports.length === 0 && (
                <li className="py-4 text-sm text-muted-foreground">No exports scheduled.</li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceExports;
