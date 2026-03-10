import { LiveDataRequiredPage } from '../../../components/LiveDataRequiredPage';

export default function ComplianceDataRequestsPage() {
  return (
    <LiveDataRequiredPage
      title="Data Subject Requests"
      feature="data request workflow"
      description="Synthetic privacy requests have been removed. This page now requires live compliance case-management data."
    />
  );
}
