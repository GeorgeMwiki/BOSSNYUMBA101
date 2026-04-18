'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@bossnyumba/design-system';

interface SubdivisionNode {
  readonly id: string;
  readonly label: string;
  readonly type: 'unit' | 'room' | 'bed' | 'parking_bay';
  readonly areaSqm?: number;
  readonly rentMonthly?: number;
  readonly children: ReadonlyArray<SubdivisionNode>;
}

const TreeNode: React.FC<{ readonly node: SubdivisionNode; readonly depth: number }> = ({ node, depth }) => (
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
      <Button size="sm" variant="outline" className="ml-auto">+ Subdivide</Button>
    </div>
    {node.children.map((c) => (
      <TreeNode key={c.id} node={c} depth={depth + 1} />
    ))}
  </div>
);

export default function UnitSubdividePage(): React.ReactElement {
  const params = useParams();
  const unitId = params?.id as string;
  const [tree, setTree] = useState<SubdivisionNode | null>(null);

  useEffect(() => {
    // TODO: wire /api/units/:id/subdivision
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/units/${unitId}/subdivision`);
        if (!cancelled && res.ok) setTree((await res.json()) as SubdivisionNode);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Subdivide unit — {unitId}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Subdivision tree</CardTitle>
        </CardHeader>
        <CardContent>
          {tree ? (
            <TreeNode node={tree} depth={0} />
          ) : (
            <p className="text-sm text-muted-foreground">No subdivisions yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
