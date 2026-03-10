import { LiveDataRequiredPage } from '../../components/LiveDataRequiredPage';

export default function Escalation() {
  return (
    <LiveDataRequiredPage
      title="Escalation"
      feature="support escalation data"
      description="Mock escalation cases and workflows have been removed. This screen now requires live support case queues and escalation endpoints."
    />
  );
}
