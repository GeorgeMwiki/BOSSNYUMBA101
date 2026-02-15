/**
 * Zod schemas for BOSSNYUMBA API modules
 * Module A: Onboarding, Module E: Payments, Module F: Maintenance
 * Module G: Documents, Module K: Renewals
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// ============================================================================
// Module A: Onboarding Schemas
// ============================================================================

export const startOnboardingSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().min(1, 'Unit ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  leaseId: z.string().optional(),
  moveInDate: z.string().min(1, 'Move-in date is required'),
  language: z.enum(['en', 'sw']).default('en'),
  preferredChannel: z.enum(['whatsapp', 'sms', 'email', 'app', 'voice']).default('whatsapp'),
});

export const checklistUpdateSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  updates: z.array(z.object({
    stepId: z.string(),
    completed: z.boolean(),
    notes: z.string().optional(),
  })).optional(),
});

export const roomConditionSchema = z.object({
  roomId: z.string().min(1),
  roomName: z.string().min(1),
  condition: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged']),
  notes: z.string().optional(),
  photos: z.array(z.string()).optional(),
  defects: z.array(z.object({
    description: z.string(),
    severity: z.enum(['minor', 'moderate', 'major']),
    photoUrl: z.string().optional(),
  })).optional(),
});

export const moveInReportSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  rooms: z.array(roomConditionSchema).min(1, 'At least one room required'),
  meterReadings: z.array(z.object({
    meterId: z.string(),
    meterType: z.enum(['electricity', 'water', 'gas']),
    reading: z.number().min(0),
    unit: z.string(),
    photoUrl: z.string().optional(),
  })).optional(),
  overallCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  generalNotes: z.string().max(2000).optional(),
  customerSignature: z.string().optional(),
  landlordSignature: z.string().optional(),
  signedAt: z.string().optional(),
  keyInventory: z.array(z.object({
    keyType: z.string(),
    quantity: z.number().int().min(0),
    notes: z.string().optional(),
  })).optional(),
});

export const procedureCompletionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  procedureId: z.string().min(1, 'Procedure ID is required'),
  comprehensionConfirmed: z.boolean().default(true),
  channel: z.enum(['whatsapp', 'app', 'voice', 'in_person']).default('app'),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// Module E: Payments Schemas
// ============================================================================

export const listInvoicesFilterSchema = paginationSchema.extend({
  status: z.enum(['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled']).optional(),
  customerId: z.string().optional(),
  leaseId: z.string().optional(),
  propertyId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  leaseId: z.string().optional(),
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  periodStart: z.string().min(1, 'Period start is required'),
  periodEnd: z.string().min(1, 'Period end is required'),
  lineItems: z.array(z.object({
    type: z.enum(['rent', 'deposit', 'late_fee', 'utility', 'service_charge', 'maintenance', 'other']),
    description: z.string().min(1),
    quantity: z.number().min(1).default(1),
    unitPrice: z.number().min(0),
    taxRate: z.number().min(0).max(100).optional(),
  })).min(1, 'At least one line item required'),
  notes: z.string().max(2000).optional(),
  paymentInstructions: z.string().max(1000).optional(),
});

export const initiatePaymentSchema = z.object({
  invoiceId: z.string().optional(),
  customerId: z.string().min(1, 'Customer ID is required'),
  leaseId: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).default('KES'),
  method: z.enum(['mpesa', 'bank_transfer', 'card', 'cash', 'mobile_money']),
  phone: z.string().optional(),
  description: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const paymentCallbackSchema = z.object({
  provider: z.enum(['mpesa', 'pesapal', 'flutterwave']),
  transactionId: z.string(),
  status: z.enum(['success', 'failed', 'pending']),
  amount: z.number().optional(),
  reference: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const reconciliationMatchSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  confidence: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const customerStatementQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  includeDetails: z.coerce.boolean().default(true),
});

// ============================================================================
// Module F: Maintenance Schemas
// ============================================================================

export const createMaintenanceRequestSchema = z.object({
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().optional(),
  customerId: z.string().optional(),
  category: z.enum(['plumbing', 'electrical', 'hvac', 'general', 'appliance', 'structural', 'pest_control', 'landscaping']),
  priority: z.enum(['low', 'medium', 'high', 'emergency']).default('medium'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  location: z.string().max(200).optional(),
  photos: z.array(z.string()).optional(),
  preferredDate: z.string().optional(),
  accessInstructions: z.string().max(500).optional(),
  permissionToEnter: z.boolean().default(false),
});

export const listMaintenanceRequestsSchema = paginationSchema.extend({
  status: z.enum(['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
  category: z.enum(['plumbing', 'electrical', 'hvac', 'general', 'appliance', 'structural', 'pest_control', 'landscaping']).optional(),
  propertyId: z.string().optional(),
  customerId: z.string().optional(),
  vendorId: z.string().optional(),
});

export const updateMaintenanceStatusSchema = z.object({
  status: z.enum(['triaged', 'assigned', 'scheduled', 'in_progress', 'completed', 'cancelled']),
  notes: z.string().max(1000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
  category: z.enum(['plumbing', 'electrical', 'hvac', 'general', 'appliance', 'structural', 'pest_control', 'landscaping']).optional(),
});

export const createWorkOrderSchema = z.object({
  maintenanceRequestId: z.string().optional(),
  propertyId: z.string().min(1, 'Property ID is required'),
  unitId: z.string().optional(),
  customerId: z.string().optional(),
  vendorId: z.string().optional(),
  category: z.enum(['plumbing', 'electrical', 'hvac', 'general', 'appliance', 'structural', 'pest_control', 'landscaping']),
  priority: z.enum(['low', 'medium', 'high', 'emergency']).default('medium'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  location: z.string().max(200).optional(),
  estimatedCost: z.number().min(0).optional(),
  scheduledDate: z.string().optional(),
  scheduledTimeSlot: z.string().optional(),
});

export const dispatchWorkOrderSchema = z.object({
  vendorId: z.string().min(1, 'Vendor ID is required'),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  scheduledTimeSlot: z.string().optional(),
  notes: z.string().max(1000).optional(),
  notifyCustomer: z.boolean().default(true),
});

export const completeWorkOrderSchema = z.object({
  completionNotes: z.string().min(1, 'Completion notes required').max(2000),
  actualCost: z.number().min(0).optional(),
  laborHours: z.number().min(0).optional(),
  materialsUsed: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    cost: z.number().optional(),
  })).optional(),
  photos: z.array(z.string()).optional(),
  customerSignature: z.string().optional(),
});

// ============================================================================
// Module G: Documents Schemas
// ============================================================================

export const uploadDocumentSchema = z.object({
  category: z.enum(['lease', 'id', 'proof_of_income', 'reference', 'inspection', 'receipt', 'notice', 'legal', 'other']),
  name: z.string().min(1, 'Document name is required').max(200),
  description: z.string().max(500).optional(),
  customerId: z.string().optional(),
  leaseId: z.string().optional(),
  propertyId: z.string().optional(),
  entityType: z.enum(['customer', 'lease', 'property', 'unit', 'work_order']).optional(),
  entityId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const verifyDocumentSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required'),
  verificationTypes: z.array(z.enum(['ocr', 'fraud_check', 'expiry_check', 'signature_verify'])).min(1),
  extractFields: z.array(z.string()).optional(),
});

export const listDocumentsSchema = paginationSchema.extend({
  category: z.enum(['lease', 'id', 'proof_of_income', 'reference', 'inspection', 'receipt', 'notice', 'legal', 'other']).optional(),
  customerId: z.string().optional(),
  leaseId: z.string().optional(),
  propertyId: z.string().optional(),
  status: z.enum(['pending', 'verified', 'rejected', 'expired']).optional(),
});

export const generateEvidencePackSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  caseType: z.enum(['eviction', 'dispute', 'legal', 'insurance', 'audit', 'other']),
  customerId: z.string().optional(),
  leaseId: z.string().optional(),
  propertyId: z.string().optional(),
  documentIds: z.array(z.string()).min(1, 'At least one document required'),
  includePaymentHistory: z.boolean().default(true),
  includeMaintenanceHistory: z.boolean().default(false),
  includeCommunications: z.boolean().default(false),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }).optional(),
});

// ============================================================================
// Module K: Renewals Schemas
// ============================================================================

export const upcomingRenewalsQuerySchema = paginationSchema.extend({
  daysAhead: z.coerce.number().int().min(1).max(365).default(90),
  propertyId: z.string().optional(),
  status: z.enum(['pending', 'offered', 'accepted', 'declined', 'expired']).optional(),
});

export const generateRenewalOfferSchema = z.object({
  leaseId: z.string().min(1, 'Lease ID is required'),
  newEndDate: z.string().min(1, 'New end date is required'),
  newRentAmount: z.number().positive().optional(),
  rentIncreasePercentage: z.number().min(-50).max(100).optional(),
  newTerms: z.string().max(5000).optional(),
  offerValidUntil: z.string().min(1, 'Offer expiry date required'),
  incentives: z.array(z.object({
    type: z.string(),
    description: z.string(),
    value: z.number().optional(),
  })).optional(),
});

export const acceptRenewalSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
  acceptedTerms: z.boolean().refine(v => v === true, 'Must accept terms'),
  customerSignature: z.string().optional(),
  signedAt: z.string().optional(),
});

export const moveOutNoticeSchema = z.object({
  leaseId: z.string().min(1, 'Lease ID is required'),
  intendedMoveOutDate: z.string().min(1, 'Move-out date is required'),
  reason: z.enum(['end_of_lease', 'relocation', 'purchase', 'dissatisfaction', 'financial', 'other']),
  reasonDetails: z.string().max(1000).optional(),
  forwardingAddress: z.object({
    line1: z.string(),
    city: z.string(),
    country: z.string(),
    postalCode: z.string().optional(),
  }).optional(),
  forwardingPhone: z.string().optional(),
  forwardingEmail: z.string().email().optional(),
});

export const moveOutInspectionSchema = z.object({
  leaseId: z.string().min(1, 'Lease ID is required'),
  inspectionDate: z.string().min(1, 'Inspection date is required'),
  rooms: z.array(z.object({
    roomId: z.string(),
    roomName: z.string(),
    conditionAtMoveIn: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged']),
    conditionAtMoveOut: z.enum(['excellent', 'good', 'fair', 'poor', 'damaged']),
    damages: z.array(z.object({
      description: z.string(),
      severity: z.enum(['minor', 'moderate', 'major']),
      repairCost: z.number().min(0).optional(),
      photos: z.array(z.string()).optional(),
      isTenantResponsible: z.boolean().default(false),
    })).optional(),
    cleaningRequired: z.boolean().default(false),
    cleaningCost: z.number().min(0).optional(),
  })).min(1, 'At least one room required'),
  meterReadings: z.array(z.object({
    meterType: z.enum(['electricity', 'water', 'gas']),
    finalReading: z.number().min(0),
    photo: z.string().optional(),
  })).optional(),
  keysReturned: z.array(z.object({
    keyType: z.string(),
    quantity: z.number().int().min(0),
    allReturned: z.boolean(),
  })).optional(),
  customerSignature: z.string().optional(),
  landlordSignature: z.string().optional(),
  generalNotes: z.string().max(2000).optional(),
});

export const depositSettlementSchema = z.object({
  leaseId: z.string().min(1, 'Lease ID is required'),
  inspectionId: z.string().optional(),
  deductions: z.array(z.object({
    type: z.enum(['damage', 'cleaning', 'unpaid_rent', 'unpaid_utilities', 'key_replacement', 'other']),
    description: z.string(),
    amount: z.number().min(0),
    evidence: z.array(z.string()).optional(),
  })).optional(),
  refundMethod: z.enum(['bank_transfer', 'mpesa', 'check', 'cash']).optional(),
  refundAccountDetails: z.object({
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    accountName: z.string().optional(),
    phoneNumber: z.string().optional(),
  }).optional(),
  notes: z.string().max(1000).optional(),
});
