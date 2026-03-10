import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function SystemHealthPage() {
  return (
    <LiveDataRequiredPage
      title="System Health"
      feature="system health telemetry"
      description="Synthetic infrastructure metrics and randomized service health have been removed. This screen will return once it is backed by live telemetry and incident data."
    />
  );
}
