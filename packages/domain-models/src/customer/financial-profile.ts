/**
 * Financial Profile Domain Model
 */

export type FinancialProfileId = string;
export type CreditRiskRating = 'low' | 'medium' | 'high' | 'very_high' | 'not_assessed';
export type PaymentTendency = 'excellent' | 'good' | 'fair' | 'poor' | 'not_assessed';

export interface LitigationRecord {
  caseNumber: string;
  court: string;
  status: string;
  description: string;
  amount?: number;
}

export interface FinancialProfile {
  id: FinancialProfileId;
  tenantId: string;
  customerId: string;
  employmentStatus?: string;
  businessName?: string;
  businessRegistrationNumber?: string;
  tinNumber?: string;
  annualRevenue?: number;
  currency: string;
  financialStatementUrls: Array<{ url: string; year: string; type: string }>;
  bankStatementUrls: string[];
  bankName?: string;
  bankAccountRef?: string;
  hasActiveLitigation: boolean;
  litigationDetails: LitigationRecord[];
  previousDefaultHistory: boolean;
  defaultDetails: string[];
  creditRiskRating: CreditRiskRating;
  paymentTendency: PaymentTendency;
  creditAssessmentNotes?: string;
  creditAssessedAt?: string;
  creditAssessedBy?: string;
  guarantorName?: string;
  guarantorIdNumber?: string;
  guarantorPhone?: string;
  guarantorAddress?: string;
  guarantorRelationship?: string;
  riskAssessmentNotes?: string;
  createdAt: string;
  updatedAt: string;
}
