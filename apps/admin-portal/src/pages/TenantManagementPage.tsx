import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function TenantManagementPage() {
  return (
    <LiveDataRequiredPage
      title="Tenant Management"
      feature="tenant management operations"
      description="This page requires live tenant provisioning, billing, and policy data from the platform backend."
    />
  );
}
