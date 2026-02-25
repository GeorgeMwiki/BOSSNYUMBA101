'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@bossnyumba/design-system';
import { useI18n, LanguageSwitcher } from '@bossnyumba/i18n';

export default function AdminPortalHome() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{t('admin.dashboard.title')}</h1>
            <Badge variant="secondary">Internal</Badge>
          </div>
          <LanguageSwitcher className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.dashboard.totalTenants')}</CardTitle>
              <CardDescription>{t('admin.dashboard.platformOverview')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.dashboard.totalProperties')}</CardTitle>
              <CardDescription>{t('admin.dashboard.platformOverview')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.dashboard.totalUsers')}</CardTitle>
              <CardDescription>{t('admin.dashboard.platformOverview')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.dashboard.systemHealth')}</CardTitle>
              <CardDescription>{t('admin.platform.systemStatus')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.dashboard.totalTenants')}</CardTitle>
              <CardDescription>{t('admin.dashboard.platformOverview')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                {t('common.actions.create')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('common.actions.view')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('admin.platform.subscriptions')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.platform.title')}</CardTitle>
              <CardDescription>{t('admin.platform.systemStatus')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                {t('admin.compliance.auditLog')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('admin.dashboard.systemHealth')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('admin.platform.featureFlags')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
