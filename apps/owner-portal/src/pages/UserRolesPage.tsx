import { useTranslations } from 'next-intl';
import { MissingBackendNotice } from '../components/MissingBackendNotice';

/**
 * UserRolesPage — placeholder until the role-management endpoints land.
 *
 * Required gateway routes:
 *   GET    /api/v1/admin/roles
 *   POST   /api/v1/admin/roles
 *   PATCH  /api/v1/admin/roles/:id
 *   DELETE /api/v1/admin/roles/:id
 */
export function UserRolesPage() {
  const t = useTranslations('pages');
  return (
    <MissingBackendNotice
      title={t('userRolesTitleLabel')}
      endpoint="GET /api/v1/admin/roles"
      description={t('userRolesDescription')}
    />
  );
}
