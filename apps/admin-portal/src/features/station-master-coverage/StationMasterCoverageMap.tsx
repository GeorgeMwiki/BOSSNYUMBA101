import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Alert,
  AlertDescription,
  Skeleton,
  EmptyState,
} from '@bossnyumba/design-system';
import { api } from '../../lib/api';

export interface StationMasterCoverage {
  readonly masterId: string;
  readonly name: string;
  readonly regions: ReadonlyArray<{ readonly id: string; readonly name: string; readonly propertyCount: number }>;
  readonly status: 'active' | 'on_leave' | 'unavailable';
}

interface StationMasterCoverageMapProps {
  readonly onReassign?: () => void;
}

export const StationMasterCoverageMap: React.FC<StationMasterCoverageMapProps> = ({ onReassign }) => {
  const [coverage, setCoverage] = useState<ReadonlyArray<StationMasterCoverage>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire GET /admin/station-masters/coverage endpoint.
      const res = await api.get?.<ReadonlyArray<StationMasterCoverage>>(
        '/admin/station-masters/coverage'
      );
      if (!signal?.aborted) {
        setCoverage(res?.data ?? []);
        setLoading(false);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to load coverage');
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const reassignDisabled = typeof onReassign !== 'function';

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Station Master Coverage</h1>
        <Button
          variant="outline"
          onClick={onReassign}
          disabled={reassignDisabled}
          title={reassignDisabled ? 'Reassignment flow not yet available' : undefined}
          aria-label="Reassign regions to station masters"
        >
          Reassign regions
        </Button>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button variant="link" size="sm" onClick={() => void load()} className="ml-2">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* TODO: Replace placeholder with Mapbox/Leaflet heatmap of region coverage. */}
      <Card>
        <CardHeader>
          <CardTitle>Coverage Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="h-64 flex items-center justify-center bg-muted rounded-md text-sm text-muted-foreground"
            role="img"
            aria-label="Coverage map placeholder"
          >
            Map placeholder — renders region polygons colored by assigned station master.
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2" aria-live="polite">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : coverage.length === 0 ? (
        <EmptyState
          title="No station masters assigned"
          description="Once station masters are assigned to regions, their coverage summary will appear here."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {coverage.map((m) => (
            <Card key={m.masterId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{m.name}</CardTitle>
                  <Badge>{m.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {m.regions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No regions assigned.</p>
                ) : (
                  <ul className="text-sm">
                    {m.regions.map((r) => (
                      <li key={r.id} className="flex justify-between">
                        <span>{r.name}</span>
                        <span className="text-muted-foreground">{r.propertyCount} props</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StationMasterCoverageMap;
