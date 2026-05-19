/**
 * SovereignLedgerPort — append-only audit-trail for every verification.
 *
 * Every pipeline run (success or fail) writes one entry. The entry is
 * the auditing surface for L1 #4 / L3 #4 / L3 #7. We never mutate.
 */

export interface SovereignLedgerEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly tenantId: string | null;
  readonly actionClass: string;
  readonly module: string;
  readonly verdict: 'pass' | 'fail' | 'defer' | 'flag';
  readonly summary: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface SovereignLedgerPort {
  append(entry: SovereignLedgerEntry): Promise<void>;
}

/**
 * In-memory ledger used by tests + as a default when wiring code has not
 * supplied a durable implementation. Read-only inspection helpers live
 * here too.
 */
export class InMemorySovereignLedger implements SovereignLedgerPort {
  private readonly entries: SovereignLedgerEntry[] = [];

  async append(entry: SovereignLedgerEntry): Promise<void> {
    this.entries.push(entry);
  }

  list(): ReadonlyArray<SovereignLedgerEntry> {
    return this.entries.slice();
  }

  clear(): void {
    this.entries.length = 0;
  }
}
