/**
 * Document Intelligence & Identity Verification Service
 * 
 * This module provides comprehensive document processing, identity verification,
 * and fraud detection capabilities for the BOSSNYUMBA property management platform.
 * 
 * Implements Module G from the BOSSNYUMBA specification:
 * - G.1: Document Collection Service (multi-channel upload, quality validation)
 * - G.2: OCR & Data Extraction (AWS Textract/Google Vision integration)
 * - G.3: Fraud Detection Engine (integrity checks, anomaly detection)
 * - G.4: Validation & Consistency Service (cross-document validation)
 * - G.6: Expiry Tracking Service (document expiry monitoring)
 * - G.7: Evidence Pack Builder (legal evidence compilation)
 */

// ============================================================================
// Types & Schemas
// ============================================================================
export * from './types/index.js';

// ============================================================================
// Repository Interfaces
// ============================================================================
export * from './repositories/interfaces.js';

// ============================================================================
// Services
// ============================================================================
export { DocumentCollectionService, MockImageQualityAnalyzer } from './services/document-collection.service.js';
export { OCRExtractionService, MockOCRProvider } from './services/ocr-extraction.service.js';
export { FraudDetectionService, MockImageAnalyzer } from './services/fraud-detection.service.js';
export { ValidationConsistencyService, MockExternalVerificationProvider } from './services/validation-consistency.service.js';
export { EvidencePackService, MockPDFGenerator } from './services/evidence-pack.service.js';
export { ExpiryTrackingService } from './services/expiry-tracking.service.js';

// ============================================================================
// API Routes
// ============================================================================
export {
  documentIntelligenceRoutes,
  createDocumentIntelligenceRoutes,
  // Request/Response schemas
  uploadDocumentSchema,
  verifyDocumentSchema,
  verifyBatchSchema,
  validateCustomerSchema,
  generateEvidencePackSchema,
  generateQuickPackSchema,
  createBadgeSchema,
  revokeBadgeSchema,
  requestReuploadSchema,
  recordFraudReviewSchema,
  recordValidationReviewSchema,
  createExpiryTrackerSchema,
  sendMissingDocChaserSchema,
  // Param/Query schemas
  documentIdParamSchema,
  customerIdParamSchema,
  packIdParamSchema,
  badgeIdParamSchema,
  trackerIdParamSchema,
  fraudScoreIdParamSchema,
  validationIdParamSchema,
  paginationQuerySchema,
  documentListQuerySchema,
  expiryQuerySchema,
  // Types
  type UploadDocumentInput,
  type VerifyDocumentInput,
  type VerifyBatchInput,
  type ValidateCustomerInput,
  type GenerateEvidencePackInput,
  type GenerateQuickPackInput,
  type CreateBadgeInput,
  type RevokeBadgeInput,
  type RequestReuploadInput,
  type RecordFraudReviewInput,
  type RecordValidationReviewInput,
  type CreateExpiryTrackerInput,
  type SendMissingDocChaserInput,
  // Helpers
  errorResponse,
  successResponse,
  validationErrorHook,
} from './routes/documents.routes.js';

// ============================================================================
// Utilities
// ============================================================================
export { logger } from './utils/logger.js';
export {
  generateDocumentId,
  generateIdentityProfileId,
  generateVerificationBadgeId,
  generateFraudRiskScoreId,
  generateEvidencePackId,
  generateExpiryTrackerId,
  generateValidationResultId,
  generateOcrExtractionId,
  generateChecksum,
} from './utils/id-generator.js';
export {
  levenshteinDistance,
  jaroWinklerSimilarity,
  normalizeName,
  extractNameParts,
  matchNames,
  normalizeIdNumber,
  matchIdNumbers,
  validateIdFormat,
} from './utils/name-matcher.js';

// ============================================================================
// Platform Observability & Authz wiring
// ============================================================================
import { Logger as ObsLogger } from '@bossnyumba/observability';
import { rbacEngine, type User as AuthzUser } from '@bossnyumba/authz-policy';

export const docIntelLogger = new ObsLogger({
  service: {
    name: 'document-intelligence',
    version: '1.0.0',
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  },
  level: (process.env.LOG_LEVEL as 'info' | 'debug' | 'warn' | 'error') || 'info',
  pretty: process.env.NODE_ENV !== 'production',
});

docIntelLogger.info('Observability initialized for document-intelligence', {
  env: process.env.NODE_ENV || 'development',
});

/**
 * Authorize a document-intelligence write (upload/verify/revoke).
 * Throws when denied so callers can surface 403 without polluting happy path.
 *
 * Callers without an AuthzUser (e.g. internal retry workers) should skip this
 * gate — they are trusted by construction.
 */
export function authorizeDocumentAction(
  user: AuthzUser,
  action: 'create' | 'update' | 'delete' | 'read',
  resource: 'document' | 'verification' | 'evidence-pack' = 'document'
): void {
  const decision = rbacEngine.checkPermission(user, action, resource);
  if (!decision.allowed) {
    docIntelLogger.warn('Document action denied by rbac', {
      userId: user.id,
      action,
      resource,
      reason: decision.reason,
    });
    const err = new Error(decision.reason ?? `Forbidden: cannot ${action} ${resource}`);
    (err as Error & { code?: string }).code = 'FORBIDDEN';
    throw err;
  }
}

export { rbacEngine as documentIntelligenceRbacEngine };
export type { AuthzUser as DocumentIntelligenceAuthzUser };

// ============================================================================
// Version
// ============================================================================
export const VERSION = '1.0.0';
export const MODULE_NAME = 'Document Intelligence & Identity Verification';
export const MODULE_CODE = 'G';
