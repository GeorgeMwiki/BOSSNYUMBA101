import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../components/MissingBackendNotice';

/**
 * UsersPage — placeholder until the user-administration endpoints land.
 *
 * Required gateway routes:
 *   GET    /api/v1/admin/users
 *   POST   /api/v1/admin/users
 *   PATCH  /api/v1/admin/users/:id
 *   DELETE /api/v1/admin/users/:id
 */
export function UsersPage() {
  const t = useTranslations('pages');
  return (
    <MissingBackendNotice
      title={t('usersTitle')}
      endpoint="GET /api/v1/admin/users"
      description={t('usersDescription')}
    />
  );
}
