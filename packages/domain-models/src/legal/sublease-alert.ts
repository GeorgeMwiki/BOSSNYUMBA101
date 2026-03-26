/**
 * Sublease Alert Domain Model
 */

export type SubleaseAlertId = string;
export type SubleaseAlertStatus = 'reported' | 'investigating' | 'confirmed' | 'dismissed' | 'resolved';
export type SubleaseAlertSource = 'inspection' | 'neighbor_report' | 'staff_observation' | 'utility_analysis' | 'anonymous_tip' | 'system_detected';
export type SubleaseRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface SubleaseAlert {
  id: SubleaseAlertId;
  tenantId: string;
  alertCode: string;
  leaseId: string;
  propertyId: string;
  unitId?: string;
  parcelId?: string;
  customerId: string;
  status: SubleaseAlertStatus;
  source: SubleaseAlertSource;
  reportedBy?: string;
  reportedAt: string;
  description: string;
  evidenceUrls: string[];
  suspectedSubtenantName?: string;
  suspectedSubtenantPhone?: string;
  suspectedSubtenantDetails?: string;
  investigatedBy?: string;
  investigatedAt?: string;
  investigationNotes?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  caseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaseMonitoringFlag {
  id: string;
  tenantId: string;
  leaseId: string;
  subleaseRiskLevel: SubleaseRiskLevel;
  subleaseProhibited: boolean;
  lastMonitoringCheck?: string;
  monitoringNotes?: string;
  flaggedForReview: boolean;
  flaggedAt?: string;
  flaggedBy?: string;
  flagReason?: string;
  createdAt: string;
  updatedAt: string;
}
