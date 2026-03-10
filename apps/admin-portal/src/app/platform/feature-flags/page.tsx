import { LiveDataRequiredPage } from '../../../components/LiveDataRequiredPage';

export default function FeatureFlagsPage() {
  return (
    <LiveDataRequiredPage
      title="Feature Flags"
      feature="feature-flag registry"
      description="Static feature-flag definitions and toggle state have been removed. This page now requires live feature configuration data."
    />
  );
}
