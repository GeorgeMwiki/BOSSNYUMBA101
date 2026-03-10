import { LiveDataRequiredPage } from '../../../components/LiveDataRequiredPage';

export default function PlatformBillingPage() {
  return (
    <LiveDataRequiredPage
      title="Billing & Invoices"
      feature="platform billing data"
      description="Static subscription invoices and collection metrics have been removed. This page now requires live platform billing data."
    />
  );
}
