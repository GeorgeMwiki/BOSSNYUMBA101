import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function TenantDetailPage() {
  return (
    <LiveDataRequiredPage
      title="Tenant Detail"
      feature="tenant detail data"
      description="This view requires live tenant policy, billing, and operational data."
    />
  );
}
