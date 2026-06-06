/**
 * Account Repository Interface
 * Defines the contract for ledger account persistence
 */
import {
  Account,
  AccountId,
  TenantId,
  CustomerId,
  OwnerId,
  PropertyId,
  AccountType,
  AccountStatus,
  CurrencyCode
} from '@bossnyumba/domain-models';
import type { RepoTx } from './transaction';

export interface AccountFilters {
  tenantId: TenantId;
  type?: AccountType | AccountType[];
  status?: AccountStatus | AccountStatus[];
  customerId?: CustomerId;
  ownerId?: OwnerId;
  propertyId?: PropertyId;
  currency?: CurrencyCode;
}

export interface IAccountRepository {
  /**
   * Create a new account
   */
  create(account: Account): Promise<Account>;

  /**
   * Get account by ID.
   *
   * `tx` (optional) runs the read on an existing transaction so a
   * caller composing a multi-statement post sees its own uncommitted
   * writes. Omit for a normal autocommit read.
   */
  findById(id: AccountId, tenantId: TenantId, tx?: RepoTx): Promise<Account | null>;

  /**
   * Get account by ID WITH a row lock (`SELECT … FOR UPDATE`).
   *
   * M2: the ledger persist step must read each touched account under a
   * lock, compute the new balance, and write it back — all inside one
   * transaction — so concurrent posts to the same account serialise
   * instead of losing updates. `tx` is REQUIRED in spirit (the lock only
   * means anything inside a transaction); the InMemory adapter ignores
   * it since it is single-threaded.
   */
  findByIdForUpdate(
    id: AccountId,
    tenantId: TenantId,
    tx?: RepoTx,
  ): Promise<Account | null>;

  /**
   * Update account. `tx` (optional) enlists the write in an existing
   * transaction.
   */
  update(account: Account, tx?: RepoTx): Promise<Account>;

  /**
   * Find accounts with filters
   */
  find(filters: AccountFilters): Promise<Account[]>;

  /**
   * Get account by customer and type
   */
  findByCustomerAndType(
    tenantId: TenantId,
    customerId: CustomerId,
    type: AccountType
  ): Promise<Account | null>;

  /**
   * Get account by owner and type
   */
  findByOwnerAndType(
    tenantId: TenantId,
    ownerId: OwnerId,
    type: AccountType
  ): Promise<Account | null>;

  /**
   * Get platform accounts
   */
  findPlatformAccounts(
    tenantId: TenantId,
    type: AccountType
  ): Promise<Account | null>;

  /**
   * Get all accounts for a customer
   */
  findByCustomer(
    tenantId: TenantId,
    customerId: CustomerId
  ): Promise<Account[]>;

  /**
   * Get all accounts for an owner
   */
  findByOwner(
    tenantId: TenantId,
    ownerId: OwnerId
  ): Promise<Account[]>;

  /**
   * Get accounts with non-zero balance for disbursement
   */
  findWithPositiveBalance(
    tenantId: TenantId,
    type: AccountType,
    minBalance: number
  ): Promise<Account[]>;

  /**
   * Atomic balance update with optimistic locking.
   * Returns true if successful, false if version mismatch.
   *
   * `tx` (optional) enlists the conditional UPDATE in an existing
   * transaction.
   */
  updateBalance(
    accountId: AccountId,
    tenantId: TenantId,
    newBalanceMinorUnits: number,
    lastEntryId: string,
    expectedVersion: number,
    tx?: RepoTx
  ): Promise<boolean>;
}

/**
 * In-memory implementation for testing
 */
export class InMemoryAccountRepository implements IAccountRepository {
  private accounts: Map<string, Account & { version: number }> = new Map();

  /**
   * Test/dev support: snapshot the store so a transaction runner can
   * roll back to it on failure. NOT part of IAccountRepository — the
   * Drizzle adapter gets real ACID rollback from Postgres. Shallow-copy
   * each record (the records are treated immutably by callers).
   */
  __snapshot(): Map<string, Account & { version: number }> {
    const copy = new Map<string, Account & { version: number }>();
    for (const [k, v] of this.accounts) copy.set(k, { ...v });
    return copy;
  }

  __restore(snapshot: Map<string, Account & { version: number }>): void {
    this.accounts = new Map();
    for (const [k, v] of snapshot) this.accounts.set(k, { ...v });
  }

  async create(account: Account): Promise<Account> {
    this.accounts.set(account.id, { ...account, version: 1 });
    return account;
  }

  // The InMemory store is single-threaded: `tx` is accepted to satisfy
  // the interface but is a no-op (there is nothing to enlist and no
  // concurrent writer to lock against).
  async findById(id: AccountId, tenantId: TenantId, _tx?: RepoTx): Promise<Account | null> {
    const account = this.accounts.get(id);
    if (account && account.tenantId === tenantId) {
      const { version, ...data } = account;
      return { ...data };
    }
    return null;
  }

  async findByIdForUpdate(
    id: AccountId,
    tenantId: TenantId,
    tx?: RepoTx,
  ): Promise<Account | null> {
    // No row locks in a single-threaded Map — behaves like findById.
    return this.findById(id, tenantId, tx);
  }

  async update(account: Account, _tx?: RepoTx): Promise<Account> {
    const existing = this.accounts.get(account.id);
    if (existing) {
      this.accounts.set(account.id, { ...account, version: existing.version + 1 });
    }
    return account;
  }

  async find(filters: AccountFilters): Promise<Account[]> {
    let items = Array.from(this.accounts.values())
      .filter(a => a.tenantId === filters.tenantId);

    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      items = items.filter(a => types.includes(a.type));
    }
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      items = items.filter(a => statuses.includes(a.status));
    }
    if (filters.customerId) {
      items = items.filter(a => a.customerId === filters.customerId);
    }
    if (filters.ownerId) {
      items = items.filter(a => a.ownerId === filters.ownerId);
    }
    if (filters.propertyId) {
      items = items.filter(a => a.propertyId === filters.propertyId);
    }
    if (filters.currency) {
      items = items.filter(a => a.currency === filters.currency);
    }

    return items.map(({ version, ...data }) => ({ ...data }));
  }

  async findByCustomerAndType(
    tenantId: TenantId,
    customerId: CustomerId,
    type: AccountType
  ): Promise<Account | null> {
    for (const account of this.accounts.values()) {
      if (
        account.tenantId === tenantId &&
        account.customerId === customerId &&
        account.type === type
      ) {
        const { version, ...data } = account;
        return { ...data };
      }
    }
    return null;
  }

  async findByOwnerAndType(
    tenantId: TenantId,
    ownerId: OwnerId,
    type: AccountType
  ): Promise<Account | null> {
    for (const account of this.accounts.values()) {
      if (
        account.tenantId === tenantId &&
        account.ownerId === ownerId &&
        account.type === type
      ) {
        const { version, ...data } = account;
        return { ...data };
      }
    }
    return null;
  }

  async findPlatformAccounts(
    tenantId: TenantId,
    type: AccountType
  ): Promise<Account | null> {
    for (const account of this.accounts.values()) {
      if (
        account.tenantId === tenantId &&
        account.type === type &&
        !account.customerId &&
        !account.ownerId
      ) {
        const { version, ...data } = account;
        return { ...data };
      }
    }
    return null;
  }

  async findByCustomer(
    tenantId: TenantId,
    customerId: CustomerId
  ): Promise<Account[]> {
    return Array.from(this.accounts.values())
      .filter(a => a.tenantId === tenantId && a.customerId === customerId)
      .map(({ version, ...data }) => ({ ...data }));
  }

  async findByOwner(
    tenantId: TenantId,
    ownerId: OwnerId
  ): Promise<Account[]> {
    return Array.from(this.accounts.values())
      .filter(a => a.tenantId === tenantId && a.ownerId === ownerId)
      .map(({ version, ...data }) => ({ ...data }));
  }

  async findWithPositiveBalance(
    tenantId: TenantId,
    type: AccountType,
    minBalance: number
  ): Promise<Account[]> {
    return Array.from(this.accounts.values())
      .filter(a =>
        a.tenantId === tenantId &&
        a.type === type &&
        a.status === 'ACTIVE' &&
        a.balanceMinorUnits >= minBalance
      )
      .map(({ version, ...data }) => ({ ...data }));
  }

  async updateBalance(
    accountId: AccountId,
    tenantId: TenantId,
    newBalanceMinorUnits: number,
    lastEntryId: string,
    expectedVersion: number,
    _tx?: RepoTx
  ): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account || account.tenantId !== tenantId) {
      return false;
    }
    if (account.version !== expectedVersion) {
      return false; // Optimistic lock failure
    }
    
    account.balanceMinorUnits = newBalanceMinorUnits;
    account.lastEntryId = lastEntryId;
    account.lastEntryAt = new Date();
    account.entryCount += 1;
    account.updatedAt = new Date();
    account.version += 1;
    
    return true;
  }
}
