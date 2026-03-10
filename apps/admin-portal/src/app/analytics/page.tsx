import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function AnalyticsPage() {
  return (
    <LiveDataRequiredPage
      title="Analytics Dashboard"
      feature="analytics telemetry"
      description="Static analytics dashboards have been removed. This page now requires live analytics and product telemetry."
    />
  );
}
