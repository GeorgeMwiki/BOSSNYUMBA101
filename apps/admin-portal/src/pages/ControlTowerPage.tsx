import { LiveDataRequiredPage } from '../components/LiveDataRequiredPage';

export function ControlTowerPage() {
  return (
    <LiveDataRequiredPage
      title="Control Tower"
      feature="platform control tower telemetry"
      description="Synthetic exceptions, AI decisions, and randomized platform metrics have been removed. This view must be connected to live operations, review queues, and incident streams before it is re-enabled."
    />
  );
}
