/**
 * Payment Repository Implementations
 * PostgreSQL implementations for Invoice, Payment, and Transaction persistence
 */

import {
  eq,
  and,
  desc,
  isNull,
  lt,
  notInArray,
  count,
  max,
} from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import { invoices, payments, transactions } from '../schemas/index.js';
import type { TenantId } from '@bossnyumba/domain-models';

const NON_OVERDUE_INVOICE_STATUSES = ['paid', 'cancelled', 'void'] as const;

// ============================================================================
// InvoiceRepository
// ============================================================================

export class InvoiceRepository {
  constructor(private db: DatabaseClient) {}

  async findMany(tenantId: TenantId, limit = 50, offset = 0) {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      )
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      );
    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async findById(id: string, tenantId: TenantId) {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId), isNull(invoices.deletedAt)));
    return rows[0] ?? null;
  }

  async findByNumber(invoiceNumber: string, tenantId: TenantId) {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.invoiceNumber, invoiceNumber),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      );
    return rows[0] ?? null;
  }

  async findByCustomer(customerId: string, tenantId: TenantId, limit = 50, offset = 0) {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.customerId, customerId),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      )
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.customerId, customerId),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      );
    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async findByLease(leaseId: string, tenantId: TenantId, limit = 50, offset = 0) {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.leaseId, leaseId),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      )
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.leaseId, leaseId),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      );
    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async findByStatus(status: string, tenantId: TenantId, limit = 50, offset = 0) {
    const rows = await this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, status),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      )
      .orderBy(desc(invoices.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(invoices)
      .where(
        and(
          eq(invoices.status, status),
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      );
    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async findOverdue(tenantId: TenantId) {
    return this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          lt(invoices.dueDate, new Date()),
          isNull(invoices.deletedAt),
          notInArray(invoices.status, [...NON_OVERDUE_INVOICE_STATUSES])
        )
      )
      .orderBy(desc(invoices.dueDate));
  }

  async create(data: typeof invoices.$inferInsert) {
    const [row] = await this.db.insert(invoices).values(data).returning();
    return row!;
  }

  async update(id: string, tenantId: TenantId, data: Partial<typeof invoices.$inferInsert>) {
    const [row] = await this.db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
      .returning();
    return row ?? null;
  }

  async delete(id: string, tenantId: TenantId, deletedBy: string) {
    await this.db
      .update(invoices)
      .set({ deletedAt: new Date(), deletedBy })
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
  }

  async getNextSequence(tenantId: TenantId): Promise<number> {
    const [{ count: c }] = await this.db
      .select({ count: count() })
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId));
    return (c ?? 0) + 1;
  }
}

// ============================================================================
// PaymentRepository
// ============================================================================

export class PaymentRepository {
  constructor(private db: DatabaseClient) {}

  async findMany(tenantId: TenantId, limit = 50, offset = 0) {
    const rows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(payments)
      .where(eq(payments.tenantId, tenantId));
    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async findById(id: string, tenantId: TenantId) {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.tenantId, tenantId)));
    return rows[0] ?? null;
  }

  async findByNumber(paymentNumber: string, tenantId: TenantId) {
    const rows = await this.db
      .select()
      .from(payments)
      .where(
        and(eq(payments.paymentNumber, paymentNumber), eq(payments.tenantId, tenantId))
      );
    return rows[0] ?? null;
  }

  async findByCustomer(customerId: string, tenantId: TenantId, limit = 50, offset = 0) {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.customerId, customerId), eq(payments.tenantId, tenantId)))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(payments)
      .where(and(eq(payments.customerId, customerId), eq(payments.tenantId, tenantId)));
    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async findByInvoice(invoiceId: string, tenantId: TenantId) {
    return this.db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.invoiceId, invoiceId),
          eq(payments.tenantId, tenantId)
        )
      )
      .orderBy(desc(payments.createdAt));
  }

  async findByStatus(status: string, tenantId: TenantId, limit = 50, offset = 0) {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.status, status), eq(payments.tenantId, tenantId)))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(payments)
      .where(and(eq(payments.status, status), eq(payments.tenantId, tenantId)));
    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async findByProvider(provider: string, tenantId: TenantId) {
    return this.db
      .select()
      .from(payments)
      .where(
        and(eq(payments.provider, provider), eq(payments.tenantId, tenantId))
      )
      .orderBy(desc(payments.createdAt));
  }

  async create(data: typeof payments.$inferInsert) {
    const [row] = await this.db.insert(payments).values(data).returning();
    return row!;
  }

  async update(id: string, tenantId: TenantId, data: Partial<typeof payments.$inferInsert>) {
    const [row] = await this.db
      .update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(payments.id, id), eq(payments.tenantId, tenantId)))
      .returning();
    return row ?? null;
  }

  async getNextSequence(tenantId: TenantId): Promise<number> {
    const [{ count: c }] = await this.db
      .select({ count: count() })
      .from(payments)
      .where(eq(payments.tenantId, tenantId));
    return (c ?? 0) + 1;
  }
}

// ============================================================================
// TransactionRepository (Immutable)
// ============================================================================

export class TransactionRepository {
  constructor(private db: DatabaseClient) {}

  async findById(id: string, tenantId: TenantId) {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.tenantId, tenantId)));
    return rows[0] ?? null;
  }

  async findByCustomer(customerId: string, tenantId: TenantId, limit = 50, offset = 0) {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.customerId, customerId),
          eq(transactions.tenantId, tenantId)
        )
      )
      .orderBy(desc(transactions.sequenceNumber))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(transactions)
      .where(
        and(
          eq(transactions.customerId, customerId),
          eq(transactions.tenantId, tenantId)
        )
      );
    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async findByLease(leaseId: string, tenantId: TenantId, limit = 50, offset = 0) {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.leaseId, leaseId),
          eq(transactions.tenantId, tenantId)
        )
      )
      .orderBy(desc(transactions.sequenceNumber))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(transactions)
      .where(
        and(
          eq(transactions.leaseId, leaseId),
          eq(transactions.tenantId, tenantId)
        )
      );
    return { items: rows, total, limit, offset, hasMore: offset + rows.length < total };
  }

  async findByInvoice(invoiceId: string, tenantId: TenantId) {
    return this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.invoiceId, invoiceId),
          eq(transactions.tenantId, tenantId)
        )
      )
      .orderBy(transactions.sequenceNumber);
  }

  async create(data: typeof transactions.$inferInsert) {
    const [row] = await this.db.insert(transactions).values(data).returning();
    return row!;
  }

  async getNextSequence(tenantId: TenantId, customerId?: string): Promise<number> {
    if (customerId) {
      const [{ maxSeq }] = await this.db
        .select({ maxSeq: max(transactions.sequenceNumber) })
        .from(transactions)
        .where(
          and(
            eq(transactions.tenantId, tenantId),
            eq(transactions.customerId, customerId)
          )
        );
      return (maxSeq ?? 0) + 1;
    }
    const [{ count: c }] = await this.db
      .select({ count: count() })
      .from(transactions)
      .where(eq(transactions.tenantId, tenantId));
    return (c ?? 0) + 1;
  }

  async calculateBalance(customerId: string, tenantId: TenantId): Promise<number> {
    const rows = await this.db
      .select({
        balanceAfter: transactions.balanceAfter,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.customerId, customerId),
          eq(transactions.tenantId, tenantId)
        )
      )
      .orderBy(desc(transactions.sequenceNumber))
      .limit(1);
    return rows[0]?.balanceAfter ?? 0;
  }
}
