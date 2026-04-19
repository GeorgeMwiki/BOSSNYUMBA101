/**
 * CSV fixtures loaded from inline string constants so tests are portable
 * (no filesystem reads). Each fixture mirrors a realistic LPMS export.
 */

export const PROPERTIES_CSV = `property_id,property_name,address,city,unit_count,type
P-001,Sunset Heights,123 Riverside Dr,Nairobi,12,apartment_complex
P-002,"Oak Ridge, West",45 Oak Ln,Kisumu,8,estate
`;

export const UNITS_CSV = `unit_id,property_name,unit_label,bedrooms,rent_kes,status
U-01,Sunset Heights,A1,2,35000,occupied
U-02,Sunset Heights,A2,1,22000,vacant
`;

export const CUSTOMERS_CSV = `customer_id,full_name,phone,email,unit_label,property_name
C-001,Jane Mwangi,+254712345678,jane@example.com,A1,Sunset Heights
C-002,Peter Otieno,+254799000111,,A2,Sunset Heights
`;

export const LEASES_CSV = `lease_id,customer_name,unit_label,property_name,start_date,end_date,rent_kes
L-001,Jane Mwangi,A1,Sunset Heights,2024-01-01,2025-01-01,35000
`;

export const PAYMENTS_CSV = `payment_id,customer_name,amount_kes,paid_at,method,reference
PAY-1,Jane Mwangi,35000,2024-02-01,mpesa,MP123
PAY-2,Jane Mwangi,35000,2024-03-01,mpesa,MP124
`;

/** Same data, renamed columns — exercises the configurable column map. */
export const PROPERTIES_CSV_ALTERNATE = `code,title,street,town,count,kind
P-010,Palm Court,9 Palm Ave,Mombasa,6,single_family
`;

export const MALFORMED_CSV = `property_id,property_name
P-001,"unterminated`;
