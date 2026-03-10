import { LiveDataRequiredPage } from '../../../components/LiveDataRequiredPage';

export default function AnalyticsUsagePage() {
  return (
    <LiveDataRequiredPage
      title="Usage Analytics"
      feature="usage analytics"
      description="Static usage analytics have been removed. This page now requires live product usage telemetry."
    />
  );
}
