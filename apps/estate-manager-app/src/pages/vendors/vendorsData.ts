export interface VendorListItem {
  id: string;
  vendorNumber: string;
  name: string;
  specializations: string[];
  rating: number;
  totalJobs: number;
  onTimePercentage: number;
  status: string;
}

export const mockVendors: VendorListItem[] = [
  {
    id: '1',
    vendorNumber: 'VND-2024-0001',
    name: 'QuickFix Plumbing',
    specializations: ['Plumbing', 'Water Heaters'],
    rating: 4.8,
    totalJobs: 124,
    onTimePercentage: 96,
    status: 'active',
  },
  {
    id: '2',
    vendorNumber: 'VND-2024-0002',
    name: 'Pro Electric Co',
    specializations: ['Electrical', 'HVAC'],
    rating: 4.6,
    totalJobs: 89,
    onTimePercentage: 92,
    status: 'active',
  },
  {
    id: '3',
    vendorNumber: 'VND-2024-0003',
    name: 'General Maintenance Solutions',
    specializations: ['General', 'Structural', 'Appliances'],
    rating: 4.4,
    totalJobs: 56,
    onTimePercentage: 88,
    status: 'active',
  },
  {
    id: '4',
    vendorNumber: 'VND-2024-0004',
    name: 'SecureLock Services',
    specializations: ['Security', 'Locks'],
    rating: 4.9,
    totalJobs: 34,
    onTimePercentage: 100,
    status: 'active',
  },
];
