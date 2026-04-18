import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@bossnyumba/design-system';

export interface TenantRisk {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly tier: 'low' | 'medium' | 'high' | 'critical';
  readonly score: number; // 0-100
  readonly drivers: ReadonlyArray<{ readonly code: string; readonly label: string; readonly weight: number }>;
  readonly narrative: string; // LLM-generated
}

interface Props {
  readonly risk: TenantRisk;
}

const tierColor: Record<TenantRisk['tier'], string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

export const TenantRiskCard: React.FC<Props> = ({ risk }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>{risk.tenantName}</CardTitle>
        <span className={`px-2 py-1 rounded text-xs font-medium ${tierColor[risk.tier]}`}>
          {risk.tier.toUpperCase()} · {risk.score}
        </span>
      </div>
    </CardHeader>
    <CardContent>
      <div>
        <h4 className="text-sm font-medium mb-1">Top drivers</h4>
        <ul className="text-sm space-y-1">
          {risk.drivers.slice(0, 5).map((d) => (
            <li key={d.code} className="flex justify-between">
              <span>{d.label}</span>
              <Badge>{d.weight.toFixed(2)}</Badge>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <h4 className="text-sm font-medium mb-1">AI narrative</h4>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{risk.narrative}</p>
      </div>
    </CardContent>
  </Card>
);

export default TenantRiskCard;
