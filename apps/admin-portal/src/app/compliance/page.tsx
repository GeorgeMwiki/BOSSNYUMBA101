import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function CompliancePage() {
  return (
    <LiveDataRequiredPage
      title="Compliance Overview"
      feature="compliance overview data"
      description="Synthetic compliance scorecards and tenant review status have been removed. This view now requires live compliance records."
    />
  );
}
