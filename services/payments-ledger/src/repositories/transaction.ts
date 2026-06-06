/**
 * Transaction plumbing for the ledger persist step (M2 — CRITICAL).
 *
 * `postJournalEntry` must insert ledger entries AND mutate every touched
 * account balance inside ONE database transaction, with each account row
 * locked (`SELECT … FOR UPDATE`) before its new balance is computed.
 * Without this:
 *
 *   1. A crash between `createEntries` and the balance UPDATE leaves the
 *      stored balance permanently out of step with the entries (the
 *      double-entry invariant the whole service exists to protect).
 *   2. Two concurrent posts to the same account read the same starting
 *      balance and the second UPDATE clobbers the first (a classic
 *      read-modify-write lost update).
 *
 * The repositories expose their methods with an optional `tx` handle so
 * the service can run them all on the same transaction. We deliberately
 * derive the handle's type from the real Drizzle client's `transaction`
 * callback rather than re-declaring it, so the InMemory adapters and the
 * Drizzle adapters speak exactly the same shape and a drizzle version
 * bump can't silently drift the contract.
 */
import type { DatabaseClient } from '@bossnyumba/database';

/**
 * The handle Drizzle hands to a `db.transaction(async (tx) => …)`
 * callback. Structurally a scoped query runner (`select`/`insert`/
 * `update`/…). Repos accept this where they would otherwise use the
 * top-level client, so every statement in a post joins the same tx.
 */
export type RepoTx = Parameters<
  Parameters<DatabaseClient['transaction']>[0]
>[0];

/**
 * Minimal transaction runner the LedgerService depends on. The Drizzle
 * client satisfies this directly (`db.transaction`). In-memory wiring
 * supplies {@link inMemoryTransactionRunner}, which runs the callback
 * with `undefined` — the InMemory repos are single-threaded and treat a
 * missing tx as "just use my Map", so atomicity is trivially satisfied.
 */
export interface TransactionRunner {
  transaction<T>(fn: (tx: RepoTx) => Promise<T>): Promise<T>;
}

/**
 * Test/dev transaction runner. Invokes the callback with no real tx.
 *
 * IMPORTANT: this provides NO rollback. It exists only so the InMemory
 * repositories (which never persist across a process and run on a single
 * thread) can share the same code path. The "a throw inside the tx
 * persists nothing" guarantee under InMemory holds because the service
 * stages all writes and only applies them after the read/compute phase
 * succeeds — see `postJournalEntry`. Production correctness comes from
 * the real Drizzle `db.transaction`.
 */
export const inMemoryTransactionRunner: TransactionRunner = {
  async transaction<T>(fn: (tx: RepoTx) => Promise<T>): Promise<T> {
    // No real transaction context — InMemory repos accept `undefined`
    // and fall back to their in-process store.
    return fn(undefined as unknown as RepoTx);
  },
};
