/**
 * Fixed Asset Register & Condition Survey Domain Models
 */

export type AssetRegisterId = string;
export type ConditionSurveyId = string;
export type SurveyItemId = string;

export type FixedAssetType = 'building' | 'land' | 'warehouse' | 'godown' | 'infrastructure' | 'equipment' | 'vehicle' | 'other';
export type AssetCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'condemned' | 'not_assessed';
export type AssetOccupancyStatus = 'occupied' | 'unoccupied' | 'partially_occupied';
export type SurveyStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
export type SurveyItemPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AssetRegisterEntry {
  id: AssetRegisterId;
  tenantId: string;
  assetCode: string;
  name: string;
  type: FixedAssetType;
  description?: string;
  propertyId?: string;
  unitId?: string;
  parcelId?: string;
  organizationId?: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  currency: string;
  currentBookValue?: number;
  depreciationRate?: number;
  currentCondition: AssetCondition;
  lastSurveyDate?: string;
  lastSurveyId?: string;
  nextSurveyDue?: string;
  occupancyStatus: AssetOccupancyStatus;
  currentCustomerId?: string;
  currentLeaseId?: string;
  monthlyRentAmount?: number;
  annualRevenue?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  images: string[];
  documents: string[];
  metadata: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConditionSurvey {
  id: ConditionSurveyId;
  tenantId: string;
  surveyCode: string;
  title: string;
  description?: string;
  status: SurveyStatus;
  financialYear: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  leadSurveyorId?: string;
  surveyTeam: Array<{ userId: string; name: string; role: string }>;
  organizationId?: string;
  totalAssets: number;
  completedAssets: number;
  summary?: string;
  findings: Record<string, unknown>;
  recommendations: string[];
  totalEstimatedRepairCost?: number;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyItem {
  id: SurveyItemId;
  tenantId: string;
  surveyId: ConditionSurveyId;
  assetId: AssetRegisterId;
  surveyorId?: string;
  conditionBefore?: AssetCondition;
  conditionAfter: AssetCondition;
  structuralIntegrity?: string;
  roofCondition?: string;
  plumbingCondition?: string;
  electricalCondition?: string;
  paintCondition?: string;
  generalNotes?: string;
  defectsFound: Array<{ description: string; severity: string; location: string; photo?: string }>;
  repairsRequired: Array<{ description: string; priority: string; estimatedCost: number }>;
  maintenanceRequired: boolean;
  estimatedRepairCost?: number;
  currency: string;
  priorityLevel?: SurveyItemPriority;
  photos: Array<{ url: string; caption: string; takenAt?: string; type: string }>;
  surveyedAt: string;
  createdAt: string;
  updatedAt: string;
}
