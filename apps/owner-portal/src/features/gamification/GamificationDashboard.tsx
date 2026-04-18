import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@bossnyumba/design-system';
import { api } from '../../lib/api';

export interface GamificationConfig {
  readonly enabled: boolean;
  readonly onTimeRentPoints: number;
  readonly referralPoints: number;
  readonly reviewPoints: number;
}

export interface GamificationStats {
  readonly activeParticipants: number;
  readonly totalPointsIssued: number;
  readonly topTenants: ReadonlyArray<{ readonly tenantId: string; readonly name: string; readonly points: number }>;
}

export const GamificationDashboard: React.FC = () => {
  const [config, setConfig] = useState<GamificationConfig | null>(null);
  const [stats, setStats] = useState<GamificationStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // TODO: wire GET /owner/gamification/config and /stats
      const cfg = await api.get?.<GamificationConfig>('/owner/gamification/config');
      const st = await api.get?.<GamificationStats>('/owner/gamification/stats');
      if (!cancelled) {
        setConfig(cfg?.data ?? null);
        setStats(st?.data ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (): Promise<void> => {
    if (!config) return;
    const next: GamificationConfig = { ...config, enabled: !config.enabled }; // immutable
    setConfig(next);
    // TODO: wire PUT /owner/gamification/config
    // patch is used because the current api client does not expose put().
    await api.patch('/owner/gamification/config', next);
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Gamification</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Configuration</CardTitle>
            <Button onClick={toggle} variant={config?.enabled ? 'destructive' : 'primary'}>
              {config?.enabled ? 'Disable' : 'Enable'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {config ? (
            <ul className="text-sm space-y-1">
              <li>On-time rent: {config.onTimeRentPoints} pts</li>
              <li>Referral: {config.referralPoints} pts</li>
              <li>Review: {config.reviewPoints} pts</li>
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Loading config...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aggregate stats</CardTitle>
        </CardHeader>
        <CardContent>
          {stats ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Active participants</p>
                  <p className="text-2xl font-semibold">{stats.activeParticipants}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total points issued</p>
                  <p className="text-2xl font-semibold">{stats.totalPointsIssued.toLocaleString()}</p>
                </div>
              </div>
              <h4 className="text-sm font-medium mb-2">Top tenants</h4>
              <ul className="text-sm">
                {stats.topTenants.map((t) => (
                  <li key={t.tenantId} className="flex justify-between py-1">
                    <span>{t.name}</span>
                    <Badge>{t.points} pts</Badge>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading stats...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GamificationDashboard;
