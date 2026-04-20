import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';

export default function OwnerPortalHome() {
  const t = useTranslations('ownerHome');
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-3xl font-bold">{t('welcome')}</h1>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{t('portfolioOverview')}</CardTitle>
              <CardDescription>{t('portfolioDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">{t('properties')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('monthlyIncome')}</CardTitle>
              <CardDescription>{t('monthlyIncomeDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">KES 0</p>
              <p className="text-sm text-muted-foreground">{t('collected')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('pendingActions')}</CardTitle>
              <CardDescription>{t('pendingActionsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">{t('pendingApprovals')}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Button>{t('viewAllProperties')}</Button>
        </div>
      </div>
    </main>
  );
}
