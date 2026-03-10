import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function BillingPage() {
  return (
    <LiveDataRequiredPage
      title="Billing"
      feature="billing operations"
      description="Synthetic invoices, credits, and usage metrics have been removed. This screen now requires live billing and subscription data."
    />
  );
}
