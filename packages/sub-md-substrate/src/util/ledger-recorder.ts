/**
 * In-memory ledger recorder — test helper for primitives + verticals.
 *
 * Production wires a postgres-backed signer; this implementation lets
 * unit + contract tests assert against the exact ledger entries the
 * substrate emits without needing a database.
 */

import type { LedgerEntry, LedgerSealPort } from '../types.js';

export interface LedgerRecorder extends LedgerSealPort {
  readonly entries: ReadonlyArray<LedgerEntry>;
  /** Returns a copy. Snapshot is not live. */
  snapshot(): ReadonlyArray<LedgerEntry>;
  clear(): void;
}

export function createLedgerRecorder(): LedgerRecorder {
  const ledger: LedgerEntry[] = [];
  let counter = 0;

  return {
    get entries(): ReadonlyArray<LedgerEntry> {
      return ledger;
    },
    async seal(entry: LedgerEntry): Promise<{ readonly sealedId: string }> {
      counter += 1;
      ledger.push(entry);
      return { sealedId: `recorder-${counter}` };
    },
    snapshot(): ReadonlyArray<LedgerEntry> {
      return ledger.slice();
    },
    clear(): void {
      ledger.length = 0;
      counter = 0;
    },
  };
}
