/**
 * receipts — public surface.
 *
 * Research-mode receipts are recorded as J1 entities of type
 * `research_session`. Re-uses K-B's receipt-store-as-J1 pattern;
 * intentionally narrower (no rollback — research is non-mutating).
 */

export { createInMemoryReceiptStore } from './in-memory-store.js';
export type {
  ReceiptStorePort,
  ResearchSessionEntity,
  ResearchSessionSearch,
} from '../ports/index.js';
