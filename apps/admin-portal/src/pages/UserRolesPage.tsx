import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function UserRolesPage() {
  return (
    <LiveDataRequiredPage
      title="User Roles"
      feature="role assignment data"
      description="Static roles and synthetic user-role mappings have been removed. This page will be re-enabled when live RBAC data and mutation endpoints are wired."
    />
  );
}
