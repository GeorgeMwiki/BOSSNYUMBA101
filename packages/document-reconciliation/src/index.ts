/**
 * @bossnyumba/document-reconciliation — public API.
 *
 * Cross-document fact reconciliation + confidence calibration + self-
 * consistency vote + per-issuer fingerprinting + EML/MSG/M-PESA-SMS/QR
 * extractors for real-estate paperwork. Pure functions + injected ports;
 * no direct SDK/DB/env. Wire the stores + LLM/decoder fallbacks at the host
 * via {@link wireDocumentReconciliation}, which ships behind the default-OFF
 * flag {@link DOCUMENT_RECONCILIATION_FLAG}.
 *
 * Extends `@bossnyumba/document-analysis`: the {@link ExtractedField} shape
 * mirrors that pipeline's extractor output, so reconciliation consumes its
 * results rather than re-implementing extraction.
 *
 * @module @bossnyumba/document-reconciliation
 */

export * from './types';

export {
  levenshtein,
  matchNames,
  normalizePhone,
  matchPhones,
  canonicalizeAddressString,
  matchAddresses,
  matchDates,
  matchAmounts,
  matchBankAccounts,
  reconcileDocBatch,
} from './fact-matcher';

export {
  buildFactBag,
  buildFactBags,
  type ExtractedField,
  type ExtractionForReconciliation,
} from './fact-bag-builder';

export {
  sigmoid,
  applyPlatt,
  calibrate,
  temperatureScaledPlatt,
  expectedCalibrationError,
  DEFAULT_PLATT,
  DEFAULT_CALIBRATION_TABLE,
  type PlattParams,
  type CalibrationTable,
  type CalibrationSample,
} from './calibration';

export {
  voteOnFields,
  type ExtractedFieldLike,
  type FieldVote,
  type VoteResult,
} from './self-consistency';

export {
  createInMemoryFingerprintStore,
  canonicaliseHeaderText,
  hashHeaderText,
  computePerceptualHash,
  matchFingerprint,
  registerFingerprint,
  type IssuerFingerprint,
  type FingerprintMatchInput,
  type FingerprintStore,
} from './issuer-fingerprint';

export {
  extractMpesaSms,
  parseOneMessage,
  type MpesaSmsRecord,
  type MpesaSmsBatchResult,
  type MpesaSmsLlmFallback,
} from './extractors/mpesa-sms';

export {
  extractEml,
  type EmlAttachment,
  type EmlExtractionResult,
} from './extractors/eml';

export {
  extractMsg,
  MsgUnsupportedError,
  type MsgExtractionResult,
  type MsgReaderPort,
} from './extractors/msg';

export {
  crossVerifyQr,
  decodeAndCrossVerify,
  type QrDecodeInput,
  type QrDecoderPort,
  type QrCrossVerifyResult,
} from './extractors/qr';

export {
  systemClock,
  safeFetch,
  issuerResolverFromStore,
  type ReconciliationStore,
  type StoredReconciliation,
  type IssuerResolver,
  type ReconciliationDataPort,
  type ReconciliationAuditSink,
  type ReconciliationClock,
} from './ports';

export {
  createInMemoryReconciliationStore,
  type InMemoryStoreOptions,
} from './in-memory-store';

export {
  wireDocumentReconciliation,
  DOCUMENT_RECONCILIATION_FLAG,
  type DocumentReconciliation,
  type DocumentReconciliationDeps,
  type WireDocumentReconciliationDeps,
} from './wire';
