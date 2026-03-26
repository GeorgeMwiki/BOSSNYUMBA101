/**
 * Application Domain Models
 */

export type ApplicationId = string;

export type ApplicationType = 'new_lease' | 'lease_renewal' | 'bareland_lease' | 'transfer' | 'modification' | 'termination' | 'rent_review' | 'other';
export type ApplicationStatus = 'received' | 'digitized' | 'at_station' | 'routed_to_hq' | 'at_emu' | 'under_review' | 'pending_civil_eng' | 'pending_dg' | 'approved' | 'rejected' | 'returned' | 'withdrawn';
export type ApplicationAssetType = 'building' | 'unit' | 'bareland' | 'portion' | 'other';

export interface Application {
  id: ApplicationId;
  tenantId: string;
  applicationNumber: string;
  type: ApplicationType;
  status: ApplicationStatus;
  customerId?: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  applicantAddress?: string;
  assetType?: ApplicationAssetType;
  propertyId?: string;
  unitId?: string;
  parcelId?: string;
  subdivisionId?: string;
  requestedLocation?: string;
  requestedSize?: string;
  proposedRentAmount?: number;
  currency: string;
  proposedLeaseTermMonths?: number;
  purposeOfUse?: string;
  letterReceivedDate: string;
  letterReceivedAt: string;
  receivingStationId?: string;
  digitalLetterUrl?: string;
  digitalizedContent?: string;
  additionalDocumentUrls: string[];
  currentAssigneeId?: string;
  currentOrganizationId?: string;
  forwardedToHqAt?: string;
  receivedAtHqAt?: string;
  assignedToEmuAt?: string;
  requiresCivilEngReview: boolean;
  civilEngNotifiedAt?: string;
  civilEngApprovedAt?: string;
  civilEngApprovedBy?: string;
  civilEngNotes?: string;
  emuReviewedAt?: string;
  emuReviewedBy?: string;
  emuNotes?: string;
  requiresDgApproval: boolean;
  dgApprovedAt?: string;
  dgApprovedBy?: string;
  dgNotes?: string;
  finalDecision?: string;
  finalDecisionAt?: string;
  finalDecisionBy?: string;
  finalDecisionNotes?: string;
  resultingLeaseId?: string;
  responseLetterUrl?: string;
  responseDate?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationRoutingEntry {
  id: string;
  tenantId: string;
  applicationId: ApplicationId;
  fromOrganizationId?: string;
  toOrganizationId?: string;
  fromUserId?: string;
  toUserId?: string;
  action: string;
  notes?: string;
  routedAt: string;
  routedBy?: string;
}
