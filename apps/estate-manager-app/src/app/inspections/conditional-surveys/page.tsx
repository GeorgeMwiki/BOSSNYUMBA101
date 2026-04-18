'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@bossnyumba/design-system';

interface ConditionalSurvey {
  readonly id: string;
  readonly unitLabel: string;
  readonly triggeredBy: string;
  readonly severityEstimate: 'minor' | 'moderate' | 'major';
  readonly status: 'draft' | 'submitted' | 'approved' | 'rejected';
}

export default function ConditionalSurveysPage(): React.ReactElement {
  const [surveys, setSurveys] = useState<ReadonlyArray<ConditionalSurvey>>([]);

  useEffect(() => {
    // TODO: wire /api/inspections/conditional-surveys
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/inspections/conditional-surveys');
        if (!cancelled && res.ok) setSurveys((await res.json()) as ReadonlyArray<ConditionalSurvey>);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Conditional Surveys</h1>
        <Button>+ New survey</Button>
      </div>
      <div className="grid gap-3">
        {surveys.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{s.unitLabel}</CardTitle>
                <Badge>{s.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Trigger: {s.triggeredBy}</p>
              <p className="text-sm">Severity: {s.severityEstimate}</p>
            </CardContent>
          </Card>
        ))}
        {surveys.length === 0 && (
          <p className="text-sm text-muted-foreground">No conditional surveys.</p>
        )}
      </div>
    </main>
  );
}
