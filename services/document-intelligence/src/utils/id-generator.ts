/**
 * ID Generator utilities
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import type {
  DocumentId,
  IdentityProfileId,
  VerificationBadgeId,
  FraudRiskScoreId,
  EvidencePackId,
  ExpiryTrackerId,
  ValidationResultId,
} from '../types/index.js';

export function generateDocumentId(): DocumentId {
  return `doc_${uuidv4()}` as DocumentId;
}

export function generateIdentityProfileId(): IdentityProfileId {
  return `idp_${uuidv4()}` as IdentityProfileId;
}

export function generateVerificationBadgeId(): VerificationBadgeId {
  return `badge_${uuidv4()}` as VerificationBadgeId;
}

export function generateFraudRiskScoreId(): FraudRiskScoreId {
  return `frs_${uuidv4()}` as FraudRiskScoreId;
}

export function generateEvidencePackId(): EvidencePackId {
  return `evp_${uuidv4()}` as EvidencePackId;
}

export function generateExpiryTrackerId(): ExpiryTrackerId {
  return `exp_${uuidv4()}` as ExpiryTrackerId;
}

export function generateValidationResultId(): ValidationResultId {
  return `val_${uuidv4()}` as ValidationResultId;
}

export function generateOCRExtractionId(): string {
  return `ocr_${uuidv4()}`;
}

// Back-compat alias for casing variants referenced elsewhere
export const generateOcrExtractionId = generateOCRExtractionId;

/**
 * SHA-256 checksum using Node's crypto module. ESM-compatible.
 * Used to ensure document integrity across upload/retrieval.
 */
export function generateChecksum(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}
