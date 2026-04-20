import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function UsersPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('usersTitle')}
      feature={t('usersFeature')}
      description={t('usersDescription')}
    />
  );
}
