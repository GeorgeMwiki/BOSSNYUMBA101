'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export default function GenerateReportPage() {
  return (
    <LiveDataRequiredPage
      title="Generate Report"
      feature="report generation"
      description="Report generation requires live reporting services. The placeholder form has been removed."
      showBack
    />
  );
}
