import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';

export default function AdminPortalHome() {
  const t = useTranslations('adminHome');
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <Badge variant="secondary">{t('internal')}</Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('totalTenants')}</CardTitle>
              <CardDescription>{t('activeOrganizations')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('totalProperties')}</CardTitle>
              <CardDescription>{t('acrossAllTenants')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('activeUsers')}</CardTitle>
              <CardDescription>{t('platformWide')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('supportTickets')}</CardTitle>
              <CardDescription>{t('openTickets')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('tenantManagement')}</CardTitle>
              <CardDescription>{t('tenantManagementDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                {t('createNewTenant')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('viewAllTenants')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('subscriptionManagement')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('platformOperations')}</CardTitle>
              <CardDescription>{t('platformOperationsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                {t('auditLogs')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('systemHealth')}
              </Button>
              <Button variant="outline" className="w-full justify-start">
                {t('featureFlags')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
