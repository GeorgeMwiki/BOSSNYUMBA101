export type {
  EvidenceKind,
  EvidenceRef,
  ObservationEvent,
  ObservationSource,
  ObservationSourceKind,
} from './types.js';
export { buildObservation, InvalidObservationError } from './build.js';
export type { BuildObservationInput } from './build.js';
export {
  ALL_FIXTURES,
  FIX_CHAT_ATTACHMENT_LEASE_END,
  FIX_CHAT_ATTACHMENT_NAME,
  FIX_CHAT_TEXT_PHONE,
  FIX_CHAT_TEXT_RENT,
  FIX_CONNECTOR_KRA,
  FIX_CONNECTOR_PHONE,
  FIX_INGEST_FILE_SALARY,
  FIX_INGEST_FILE_START_DATE,
  FIX_MANUAL_EMAIL,
  FIX_MANUAL_LEASE_END,
  FIX_SUBAGENT_HOURS,
  FIX_SUBAGENT_JURISDICTION,
} from './fixtures.js';
