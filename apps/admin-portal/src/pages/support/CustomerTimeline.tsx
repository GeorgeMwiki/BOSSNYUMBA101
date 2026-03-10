import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function CustomerTimeline() {
  return (
    <LiveDataRequiredPage
      title="Customer Timeline"
      feature="customer timeline data"
      description="Synthetic cross-tenant customer histories have been removed. This view now requires live customer, lease, payment, and support-event streams."
    />
  );
}
