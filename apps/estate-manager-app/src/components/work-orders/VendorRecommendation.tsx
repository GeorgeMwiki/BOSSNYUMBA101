'use client';

import { useTranslations } from 'next-intl';
import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

interface VendorRecommendationProps {
  category?: string;
  priority?: string;
  unitId?: string;
  propertyId?: string;
  onSelectVendor?: (vendorId: string) => void;
}

export function VendorRecommendation(_props: VendorRecommendationProps) {
  const t = useTranslations('simple');
  return (
    <LiveDataRequiredPage
      title={t('vendorRecommendation')}
      feature="vendor recommendation data"
      description="Static vendor recommendations have been removed. This component now requires live vendor ranking and assignment data."
    />
  );
}
