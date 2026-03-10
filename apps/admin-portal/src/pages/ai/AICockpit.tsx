import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function AICockpit() {
  return (
    <LiveDataRequiredPage
      title="AI Cockpit"
      feature="AI governance telemetry"
      description="Randomized AI accuracy metrics and sample decisions have been removed. This cockpit now requires live governance, review, and audit data from the AI services."
    />
  );
}
