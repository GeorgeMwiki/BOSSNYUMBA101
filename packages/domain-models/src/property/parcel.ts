/**
 * Land Parcel Domain Models
 */

export type ParcelId = string;
export type PortionId = string;

export type ParcelType = 'bareland' | 'railway_reserve' | 'residential' | 'commercial' | 'industrial' | 'mixed' | 'other';
export type ParcelStatus = 'available' | 'leased' | 'partially_leased' | 'subdivided' | 'reserved' | 'disputed' | 'under_survey' | 'archived';

export interface LandParcel {
  id: ParcelId;
  tenantId: string;
  parentParcelId?: string;
  parcelCode: string;
  name: string;
  type: ParcelType;
  status: ParcelStatus;
  description?: string;
  totalAreaSqm: number;
  leasedAreaSqm: number;
  availableAreaSqm: number;
  districtOrgId?: string;
  stationOrgId?: string;
  nearRailwayReserve: boolean;
  requiresCivilEngNotification: boolean;
  addressLine1?: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  boundaryCoordinates: Array<{ lat: number; lng: number }>;
  mapUrl?: string;
  cadastralReference?: string;
  titleDeedNumber?: string;
  titleDeedDocumentUrl?: string;
  surveyorName?: string;
  surveyDate?: string;
  surveyDocumentUrl?: string;
  images: string[];
  documents: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParcelPortion {
  id: PortionId;
  tenantId: string;
  parcelId: ParcelId;
  portionCode: string;
  portionNumber: number;
  name?: string;
  areaSqm: number;
  status: ParcelStatus;
  leaseId?: string;
  customerId?: string;
  latitude?: number;
  longitude?: number;
  boundaryCoordinates: Array<{ lat: number; lng: number }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
