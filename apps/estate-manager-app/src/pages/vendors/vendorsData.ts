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

export const mockVendors: VendorListItem[] = [];
