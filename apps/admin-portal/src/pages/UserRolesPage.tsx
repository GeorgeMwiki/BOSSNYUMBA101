import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function UserRolesPage() {
  const t = useTranslations('pages');
  return (
    <LiveDataRequiredPage
      title={t('userRolesTitleLabel')}
      feature={t('userRolesFeature')}
      description={t('userRolesDescription')}
    />
  );
}
