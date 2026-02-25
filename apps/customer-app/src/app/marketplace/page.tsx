'use client';

import { VendorCard } from '@/components/marketplace/VendorCard';
import { PageHeader } from '@/components/layout/PageHeader';

const MOCK_VENDORS = [
  { id: '1', name: 'Plumber Pro', category: 'Plumbing', rating: 4.8, price: 'From KES 2,000' },
  { id: '2', name: 'Electric Co', category: 'Electrical', rating: 4.9 },
  { id: '3', name: 'Cleaning Crew', category: 'Cleaning', rating: 4.7, price: 'KES 1,500/hr' },
  { id: '4', name: 'Locksmith Plus', category: 'Security', rating: 4.6 },
  { id: '5', name: 'AC Repair Co', category: 'HVAC', rating: 4.5, price: 'From KES 3,000' },
];

export default function MarketplacePage() {
  return (
    <main className="min-h-screen bg-[#121212]">
      <PageHeader title="Marketplace" />
      <div className="px-4 py-4 pb-24">
        <p className="text-gray-400 mb-4">
          Find vendors and services for your property
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {MOCK_VENDORS.map((v) => (
            <VendorCard key={v.id} {...v} />
          ))}
        </div>
      </div>
    </main>
  );
}
