import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  EmptyState,
} from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';

/**
 * GamificationDashboard — owner-facing surface for the rent-gamification
 * programme.
 *
 * HONEST EMPTY STATE (intentional):
 * ---------------------------------
 *   This view previously called `GET /owner/gamification/config` and
 *   `GET /owner/gamification/stats` (and `PATCH /owner/gamification/config`).
 *   Those endpoints do NOT exist on the gateway. The gamification router
 *   (services/api-gateway/src/routes/gamification.hono.ts) only serves:
 *
 *     GET  /gamification/policies          (tenant policy — different shape)
 *     PUT  /gamification/policies
 *     GET  /gamification/customers/:id     (per-customer state)
 *
 *   There is no owner-scoped config/stats aggregate, and the policy shape
 *   (onTimePoints / cashbackBps / tier thresholds) does not match the
 *   config this dashboard was built for (onTimeRentPoints / referral /
 *   review). Rather than fabricate participant counts, top-tenant
 *   leaderboards, or a fake toggle that POSTs to a 404, this component
 *   renders an explicit "not yet available" state.
 *
 *   To make this real, a backend owner-scoped endpoint is needed, e.g.
 *   `GET /owner/gamification/summary` returning { config, activeParticipants,
 *   totalPointsIssued, topTenants } aggregated across the owner's property
 *   scope. Wire this component to it once that lands.
 */
export const GamificationDashboard: React.FC = () => {
  const t = useTranslations('gamification');

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('configuration')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title={t('unavailableTitle')}
            description={t('unavailableDescription')}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default GamificationDashboard;
