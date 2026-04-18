import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@bossnyumba/design-system';
import { api } from '../../lib/api';

export interface StationMasterCoverage {
  readonly masterId: string;
  readonly name: string;
  readonly regions: ReadonlyArray<{ readonly id: string; readonly name: string; readonly propertyCount: number }>;
  readonly status: 'active' | 'on_leave' | 'unavailable';
}

export const StationMasterCoverageMap: React.FC = () => {
  const [coverage, setCoverage] = useState<ReadonlyArray<StationMasterCoverage>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // TODO: wire GET /admin/station-masters/coverage endpoint.
      const res = await api.get?.<ReadonlyArray<StationMasterCoverage>>('/admin/station-masters/coverage');
      if (!cancelled) {
        setCoverage(res?.data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Station Master Coverage</h1>
        <Button variant="outline">Reassign regions</Button>
      </div>

      {/* TODO: Replace placeholder with Mapbox/Leaflet heatmap of region coverage. */}
      <Card>
        <CardHeader>
          <CardTitle>Coverage Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground">
            Map placeholder — renders region polygons colored by assigned station master.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading coverage...</p>
        ) : (
          coverage.map((m) => (
            <Card key={m.masterId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{m.name}</CardTitle>
                  <Badge>{m.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="text-sm">
                  {m.regions.map((r) => (
                    <li key={r.id} className="flex justify-between">
                      <span>{r.name}</span>
                      <span className="text-muted-foreground">{r.propertyCount} props</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default StationMasterCoverageMap;
