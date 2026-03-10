'use client';

import { LiveDataRequiredScreen } from '@/components/LiveDataRequired';

export default function MarketplacePage() {
  return (
    <LiveDataRequiredScreen
      title="Marketplace"
      feature="marketplace listings"
      description="Static marketplace vendor listings have been removed. This page now requires live vendor and catalog data."
    />
  );
}
