/**
 * JSON fixtures — the shapes LPMS vendors tend to ship.
 */

export const JSON_OBJECT_DUMP = {
  properties: [
    {
      id: 'P-001',
      name: 'Sunset Heights',
      address: '123 Riverside Dr',
      city: 'Nairobi',
      unitCount: 12,
      type: 'apartment_complex',
    },
    {
      id: 'P-002',
      name: 'Oak Ridge',
      address: '45 Oak Ln',
      city: 'Kisumu',
      unitCount: 8,
    },
  ],
  units: [
    {
      id: 'U-01',
      propertyName: 'Sunset Heights',
      label: 'A1',
      bedrooms: 2,
      rent: 35000,
      status: 'occupied',
    },
  ],
  customers: [
    {
      id: 'C-001',
      fullName: 'Jane Mwangi',
      phone: '+254712345678',
      email: 'jane@example.com',
    },
  ],
  leases: [
    {
      id: 'L-001',
      customerName: 'Jane Mwangi',
      unitLabel: 'A1',
      propertyName: 'Sunset Heights',
      startDate: '2024-01-01',
      rent: 35000,
    },
  ],
  payments: [
    {
      id: 'PAY-1',
      customerName: 'Jane Mwangi',
      amount: 35000,
      date: '2024-02-01',
      method: 'mpesa',
      reference: 'MP123',
    },
  ],
};

export const JSON_ARRAY_DUMP = [
  { type: 'property', id: 'P-001', name: 'Array Heights' },
  { type: 'unit', propertyName: 'Array Heights', label: 'B1', rent: 18000 },
  { type: 'customer', fullName: 'Alice Waweru', phone: '+254700000000' },
  {
    type: 'payment',
    customerName: 'Alice Waweru',
    amount: 18000,
    date: '2024-05-01',
  },
];

/** Uses vendor-specific keys so the alias map must be customized. */
export const JSON_VENDOR_CUSTOM = {
  properties: [
    { buildingCode: 'B-77', buildingTitle: 'Acacia Towers' },
  ],
};
