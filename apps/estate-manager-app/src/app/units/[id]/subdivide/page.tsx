'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Alert,
  AlertDescription,
  Skeleton,
  EmptyState,
} from '@bossnyumba/design-system';

interface SubdivisionNode {
  readonly id: string;
  readonly label: string;
  readonly type: 'unit' | 'room' | 'bed' | 'parking_bay';
  readonly areaSqm?: number;
  readonly rentMonthly?: number;
  readonly children: ReadonlyArray<SubdivisionNode>;
}

interface TreeNodeProps {
  readonly node: SubdivisionNode;
  readonly depth: number;
  readonly onSubdivide: (nodeId: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, onSubdivide }) => (
  <div className="ml-4">
    <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 12 }}>
      <Badge>{node.type}</Badge>
      <span className="font-medium">{node.label}</span>
      {node.areaSqm !== undefined && (
        <span className="text-xs text-muted-foreground">{node.areaSqm} sqm</span>
      )}
      {node.rentMonthly !== undefined && (
        <span className="text-xs">{node.rentMonthly.toLocaleString()}/mo</span>
      )}
      <Button
        size="sm"
        variant="outline"
        className="ml-auto"
        onClick={() => onSubdivide(node.id)}
        aria-label={`Subdivide ${node.label}`}
      >
        + Subdivide
      </Button>
    </div>
    {node.children.map((c) => (
      <TreeNode key={c.id} node={c} depth={depth + 1} onSubdivide={onSubdivide} />
    ))}
  </div>
);

export default function UnitSubdividePage(): React.ReactElement {
  const params = useParams();
  const unitId = params?.id as string;
  const [tree, setTree] = useState<SubdivisionNode | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingParent, setPendingParent] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire /api/units/:id/subdivision
      const res = await fetch(`/api/units/${unitId}/subdivision`, { signal });
      if (res.status === 404) {
        if (!signal?.aborted) {
          setTree(null);
          setLoading(false);
        }
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as SubdivisionNode;
      if (!signal?.aborted) {
        setTree(data);
        setLoading(false);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load subdivision');
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const handleSubdivide = useCallback(async (parentId: string): Promise<void> => {
    setPendingParent(parentId);
    setError(null);
    try {
      const res = await fetch(`/api/units/${unitId}/subdivision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subdivide');
    } finally {
      setPendingParent(null);
    }
  }, [load, unitId]);

  const handleInitialSubdivide = useCallback(() => {
    if (tree) {
      void handleSubdivide(tree.id);
    } else {
      // No tree yet — create the root node by subdividing the unit itself.
      void handleSubdivide(unitId);
    }
  }, [handleSubdivide, tree, unitId]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Subdivide unit — {unitId}</h1>

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

      <Card>
        <CardHeader>
          <CardTitle>Subdivision tree</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" aria-live="polite">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : tree ? (
            <>
              {pendingParent !== null && (
                <p className="text-xs text-muted-foreground mb-2" role="status">
                  Subdividing...
                </p>
              )}
              <TreeNode node={tree} depth={0} onSubdivide={handleSubdivide} />
            </>
          ) : (
            <EmptyState
              title="No subdivisions yet"
              description="Split this unit into rooms, beds, or parking bays for granular rent tracking."
              action={
                <Button
                  onClick={handleInitialSubdivide}
                  loading={pendingParent !== null}
                  aria-label={`Start subdividing unit ${unitId}`}
                >
                  + Subdivide
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
