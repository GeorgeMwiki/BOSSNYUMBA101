'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

interface VendorRecommendationProps {
  category?: string;
  priority?: string;
  unitId?: string;
  propertyId?: string;
  onSelectVendor?: (vendorId: string) => void;
}

export function VendorRecommendation(_props: VendorRecommendationProps) {
  return (
    <LiveDataRequiredPage
      title="Vendor Recommendation"
      feature="vendor recommendation data"
      description="Static vendor recommendations have been removed. This component now requires live vendor ranking and assignment data."
    />
  );
}
