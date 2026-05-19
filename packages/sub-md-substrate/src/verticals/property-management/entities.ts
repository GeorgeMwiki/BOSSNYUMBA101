/**
 * Entity types for the property-management vertical.
 *
 * These are the property-bound nouns the existing BOSSNYUMBA sub-MDs
 * already operate on (and which the substrate now models generically).
 * We do NOT touch the existing kernel sub-MDs — this is the substrate
 * mirror of their entity shape.
 */

export type PmEntityType =
  | 'maintenance-ticket'
  | 'vendor'
  | 'work-order'
  | 'complaint'
  | 'lease'
  | 'tenant'
  | 'property'
  | 'rent-payment'
  | 'arrears';

export const PM_ENTITY_TYPES: ReadonlyArray<PmEntityType> = Object.freeze([
  'maintenance-ticket',
  'vendor',
  'work-order',
  'complaint',
  'lease',
  'tenant',
  'property',
  'rent-payment',
  'arrears',
]);

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'structural'
  | 'hvac'
  | 'pest'
  | 'general';

export type MaintenanceSeverity =
  | 'emergency'
  | 'urgent'
  | 'standard'
  | 'cosmetic';

export interface MaintenanceTicket {
  readonly id: string;
  readonly tenantId: string;
  readonly propertyId: string;
  readonly unitRef: string;
  readonly raisedAtMs: number;
  readonly reporterName: string;
  readonly issueText: string;
  /** Optional photos, hashed for de-dupe. */
  readonly photoCount: number;
  /** When set, the substrate trusts this and routes accordingly. */
  readonly preClassified?: {
    readonly category: MaintenanceCategory;
    readonly severity: MaintenanceSeverity;
  };
}

export interface VendorCandidate {
  readonly id: string;
  readonly displayName: string;
  readonly specialty: MaintenanceCategory;
  readonly avgResponseMinutes: number;
  readonly slaBreachRate: number;
  readonly costRating: 1 | 2 | 3 | 4 | 5;
  readonly afterHoursAvailable: boolean;
}
