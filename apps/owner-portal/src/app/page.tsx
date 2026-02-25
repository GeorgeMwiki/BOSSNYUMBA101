'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bossnyumba/design-system';
import { useI18n, LanguageSwitcher } from '@bossnyumba/i18n';

export default function OwnerPortalHome() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('owner.dashboard.title')}</h1>
          <LanguageSwitcher className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{t('owner.portfolio.title')}</CardTitle>
              <CardDescription>{t('owner.dashboard.portfolioValue')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">{t('owner.dashboard.totalProperties')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('owner.dashboard.monthlyIncome')}</CardTitle>
              <CardDescription>{t('estateManager.dashboard.rentCollected')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">KES 0</p>
              <p className="text-sm text-muted-foreground">{t('estateManager.dashboard.rentCollected')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('common.status.pending')}</CardTitle>
              <CardDescription>{t('owner.dashboard.performanceSummary')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">{t('common.status.pending')}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Button>{t('owner.portfolio.properties')}</Button>
        </div>
      </div>
    </main>
  );
}
