// @ts-nocheck

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { UserRole } from '../../types/user-role';
import { mapInvoiceRow, mapPaymentRow, mapVendorRow, mapWorkOrderRow } from '../db-mappers';
import { conversations } from '@bossnyumba/database';
import { eq } from 'drizzle-orm';

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toDataUrl(content, mimeType = 'text/plain') {
  return `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
}

async function getOwnerScope(auth, repos) {
  const propertiesResult = await repos.properties.findMany(auth.tenantId, {
    limit: 1000,
    offset: 0,
  });
  const properties = auth.propertyAccess?.includes('*')
    ? propertiesResult.items
    : propertiesResult.items.filter((property) => auth.propertyAccess?.includes(property.id));
  const propertyIds = new Set(properties.map((property) => property.id));

  const [unitsResult, leasesResult, customersResult, invoicesResult, paymentsResult, workOrdersResult] =
    await Promise.all([
      repos.units.findMany(auth.tenantId, { limit: 1000, offset: 0 }),
      repos.leases.findMany(auth.tenantId, { limit: 1000, offset: 0 }),
      repos.customers.findMany(auth.tenantId, { limit: 1000, offset: 0 }),
      repos.invoices.findMany(auth.tenantId, 1000, 0),
      repos.payments.findMany(auth.tenantId, 1000, 0),
      repos.workOrders.findMany(auth.tenantId, 1000, 0),
    ]);

  const units = unitsResult.items.filter((unit) => propertyIds.has(unit.propertyId));
  const unitIds = new Set(units.map((unit) => unit.id));
  const leases = leasesResult.items.filter(
    (lease) => propertyIds.has(lease.propertyId) || unitIds.has(lease.unitId)
  );
  const leaseIds = new Set(leases.map((lease) => lease.id));
  const customerIds = new Set(leases.map((lease) => lease.customerId));
  const customers = customersResult.items.filter((customer) => customerIds.has(customer.id));
  const invoices = invoicesResult.items.filter(
    (invoice) =>
      (invoice.leaseId && leaseIds.has(invoice.leaseId)) ||
      (invoice.customerId && customerIds.has(invoice.customerId))
  );
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const payments = paymentsResult.items.filter(
    (payment) =>
      (payment.leaseId && leaseIds.has(payment.leaseId)) ||
      (payment.customerId && customerIds.has(payment.customerId)) ||
      (payment.invoiceId && invoiceIds.has(payment.invoiceId))
  );
  const workOrders = workOrdersResult.items.filter((workOrder) => propertyIds.has(workOrder.propertyId));
  const vendorIds = Array.from(new Set(workOrders.map((workOrder) => workOrder.vendorId).filter(Boolean)));
  const vendors = (
    await Promise.all(vendorIds.map((vendorId) => repos.vendors.findById(vendorId, auth.tenantId)))
  ).filter(Boolean);

  return { properties, units, leases, customers, invoices, payments, workOrders, vendors };
}

function enrichOwnerInvoices(scope) {
  const leaseMap = new Map(scope.leases.map((lease) => [lease.id, lease]));
  const customerMap = new Map(scope.customers.map((customer) => [customer.id, customer]));
  const unitMap = new Map(scope.units.map((unit) => [unit.id, unit]));
  const propertyMap = new Map(scope.properties.map((property) => [property.id, property]));

  return scope.invoices.map((row) => {
    const lease = row.leaseId ? leaseMap.get(row.leaseId) : undefined;
    const customer = row.customerId ? customerMap.get(row.customerId) : undefined;
    const unit = lease?.unitId ? unitMap.get(lease.unitId) : undefined;
    const property = lease?.propertyId ? propertyMap.get(lease.propertyId) : undefined;

    return {
      ...mapInvoiceRow(row),
      customer: customer
        ? {
            id: customer.id,
            name: `${customer.firstName} ${customer.lastName}`.trim(),
          }
        : undefined,
      unit: unit ? { id: unit.id, unitNumber: unit.unitCode } : undefined,
      property: property ? { id: property.id, name: property.name } : undefined,
    };
  });
}

function enrichOwnerPayments(scope, invoices) {
  const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const customerMap = new Map(scope.customers.map((customer) => [customer.id, customer]));

  return scope.payments.map((row) => {
    const payment = mapPaymentRow(row);
    const invoice = row.invoiceId ? invoiceMap.get(row.invoiceId) : undefined;
    const customer = row.customerId
      ? customerMap.get(row.customerId)
      : invoice?.customerId
      ? customerMap.get(invoice.customerId)
      : undefined;

    return {
      ...payment,
      method: payment.paymentMethod,
      reference: payment.externalReference || payment.paymentNumber,
      customer: customer
        ? {
            id: customer.id,
            name: `${customer.firstName} ${customer.lastName}`.trim(),
          }
        : undefined,
    };
  });
}

function enrichOwnerWorkOrders(scope) {
  const unitMap = new Map(scope.units.map((unit) => [unit.id, unit]));
  const propertyMap = new Map(scope.properties.map((property) => [property.id, property]));
  const customerMap = new Map(scope.customers.map((customer) => [customer.id, customer]));
  const vendorMap = new Map(scope.vendors.map((vendor) => [vendor.id, vendor]));

  return scope.workOrders.map((row) => {
    const mapped = mapWorkOrderRow(row);
    const vendor = row.vendorId ? vendorMap.get(row.vendorId) : undefined;

    return {
      ...mapped,
      reportedAt: mapped.createdAt,
      requiresApproval:
        mapped.status === 'PENDING_APPROVAL' ||
        Number(mapped.estimatedCost || 0) >= 50000,
      approvalThreshold: 50000,
      unit: row.unitId
        ? {
            id: row.unitId,
            unitNumber: unitMap.get(row.unitId)?.unitCode || row.unitId,
          }
        : undefined,
      property: row.propertyId
        ? {
            id: row.propertyId,
            name: propertyMap.get(row.propertyId)?.name || row.propertyId,
          }
        : undefined,
      customer: row.customerId
        ? {
            id: row.customerId,
            name:
              `${customerMap.get(row.customerId)?.firstName || ''} ${
                customerMap.get(row.customerId)?.lastName || ''
              }`.trim() || row.customerId,
            phone: customerMap.get(row.customerId)?.phone,
          }
        : undefined,
      vendor: vendor
        ? {
            id: vendor.id,
            name: vendor.companyName,
            phone: Array.isArray(vendor.contacts) ? vendor.contacts[0]?.phone : undefined,
          }
        : undefined,
    };
  });
}

function buildFinancialStats(invoices, payments, workOrders) {
  const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const totalCollected = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalOutstanding = invoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
  const pendingDisbursement = Math.max(
    totalCollected -
      workOrders.reduce((sum, workOrder) => sum + Number(workOrder.actualCost || workOrder.estimatedCost || 0), 0),
    0
  );

  return {
    totalInvoiced,
    totalCollected,
    totalOutstanding,
    collectionRate,
    pendingDisbursement,
  };
}

function buildDisbursementData(scope, payments) {
  const propertyMap = new Map(scope.properties.map((property) => [property.id, property]));
  const leaseMap = new Map(scope.leases.map((lease) => [lease.id, lease]));
  const invoiceMap = new Map(scope.invoices.map((invoice) => [invoice.id, invoice]));
  const grouped = new Map();

  for (const payment of scope.payments) {
    const invoice = payment.invoiceId ? invoiceMap.get(payment.invoiceId) : undefined;
    const lease = payment.leaseId
      ? leaseMap.get(payment.leaseId)
      : invoice?.leaseId
      ? leaseMap.get(invoice.leaseId)
      : undefined;
    const propertyId = lease?.propertyId || scope.properties[0]?.id;
    const month = new Date(payment.completedAt || payment.createdAt);
    const period = month.toLocaleDateString('en', { month: 'short', year: 'numeric' });
    const key = `${propertyId || 'portfolio'}:${period}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
        reference: `DSB-${month.getFullYear()}${String(month.getMonth() + 1).padStart(2, '0')}-${String(grouped.size + 1).padStart(3, '0')}`,
        amount: 0,
        date: new Date(month.getFullYear(), month.getMonth() + 1, 5).toISOString(),
        status: 'COMPLETED',
        method: 'BANK_TRANSFER',
        period,
        property: propertyId ? { id: propertyId, name: propertyMap.get(propertyId)?.name || propertyId } : undefined,
      });
    }

    grouped.get(key).amount += payment.amount;
  }

  const disbursements = Array.from(grouped.values())
    .sort((left, right) => new Date(right.date) - new Date(left.date))
    .map((disbursement) => ({
      ...disbursement,
      breakdown: {
        rentCollected: disbursement.amount,
        managementFees: Math.round(disbursement.amount * 0.08),
        maintenanceCosts: 0,
        utilities: 0,
        insurance: 0,
        repairs: 0,
        otherDeductions: 0,
        netDisbursement: Math.round(disbursement.amount * 0.92),
      },
    }));

  const totalDisbursed = disbursements.reduce(
    (sum, disbursement) => sum + disbursement.breakdown.netDisbursement,
    0
  );
  const now = new Date();
  const nextDisbursementDate = new Date(now.getFullYear(), now.getMonth() + 1, 5).toISOString();

  return {
    disbursements,
    stats: {
      totalDisbursed,
      pendingAmount: 0,
      nextDisbursementDate,
      yearToDate: disbursements
        .filter((disbursement) => new Date(disbursement.date).getFullYear() === now.getFullYear())
        .reduce((sum, disbursement) => sum + disbursement.breakdown.netDisbursement, 0),
      averageMonthly: disbursements.length > 0 ? Math.round(totalDisbursed / disbursements.length) : 0,
    },
  };
}

async function listOwnerConversations(c, auth, repos) {
  const db = c.get('db');
  const scope = await getOwnerScope(auth, repos);
  const customerMap = new Map(scope.customers.map((customer) => [customer.id, customer]));

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.tenantId, auth.tenantId));

  const messagingRows = rows
    .sort((left, right) => new Date(right.lastMessageAt || right.updatedAt || right.createdAt) - new Date(left.lastMessageAt || left.updatedAt || left.createdAt))
    .slice(0, 100);

  const messagesByConversation = await Promise.all(
    messagingRows.map((conversation) => repos.messaging.getMessages(conversation.id, { limit: 1, offset: 0 }))
  );

  return messagingRows.map((conversation, index) => {
    const customer = conversation.customerId ? customerMap.get(conversation.customerId) : undefined;
    const latestMessage = messagesByConversation[index]?.[0];
    const participantName = customer
      ? `${customer.firstName} ${customer.lastName}`.trim()
      : conversation.title || conversation.id;

    return {
      id: conversation.id,
      participantName,
      participantRole: customer ? 'Resident' : String(conversation.type || 'Conversation').replace(/_/g, ' '),
      participantInitials: participantName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || '')
        .join(''),
      lastMessage: latestMessage?.content,
      lastMessageTime: latestMessage?.createdAt || conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt,
      unreadCount: 0,
      propertyContext:
        conversation.metadata?.propertyName ||
        conversation.metadata?.propertyId ||
        undefined,
    };
  });
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);
app.use('*', async (c, next) => {
  const auth = c.get('auth');

  if (![UserRole.OWNER, UserRole.TENANT_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(auth.role)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Owner portal access is not allowed for this role.',
        },
      },
      403
    );
  }

  await next();
});

app.get('/work-orders', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getOwnerScope(auth, repos);
  return c.json({ success: true, data: enrichOwnerWorkOrders(scope) });
});

app.post('/work-orders/:id/approve', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const existing = await repos.workOrders.findById(id, auth.tenantId);

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }

  const row = await repos.workOrders.update(id, auth.tenantId, {
    status: 'approved',
    updatedBy: auth.userId,
  });

  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

app.post('/work-orders/:id/reject', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const existing = await repos.workOrders.findById(id, auth.tenantId);

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } }, 404);
  }

  const timeline = Array.isArray(existing.timeline) ? existing.timeline : [];
  const row = await repos.workOrders.update(id, auth.tenantId, {
    status: 'rejected',
    timeline: [
      ...timeline,
      {
        at: new Date().toISOString(),
        status: 'rejected',
        by: auth.userId,
        reason: body.reason,
      },
    ],
    completionNotes: body.reason || existing.completionNotes,
    updatedBy: auth.userId,
  });

  return c.json({ success: true, data: mapWorkOrderRow(row) });
});

app.get('/financial/stats', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getOwnerScope(auth, repos);
  const invoices = enrichOwnerInvoices(scope);
  const payments = enrichOwnerPayments(scope, invoices);
  return c.json({ success: true, data: buildFinancialStats(invoices, payments, scope.workOrders) });
});

app.get('/invoices', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getOwnerScope(auth, repos);
  return c.json({ success: true, data: enrichOwnerInvoices(scope) });
});

app.get('/payments', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getOwnerScope(auth, repos);
  const invoices = enrichOwnerInvoices(scope);
  return c.json({ success: true, data: enrichOwnerPayments(scope, invoices) });
});

app.get('/reports/export/financial', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getOwnerScope(auth, repos);
  const invoices = enrichOwnerInvoices(scope);
  const payments = enrichOwnerPayments(scope, invoices);
  const lines = [
    ['type', 'reference', 'status', 'amount', 'customer', 'property', 'date'].join(','),
    ...invoices.map((invoice) =>
      [
        'invoice',
        invoice.number,
        invoice.status,
        invoice.total,
        invoice.customer?.name || '',
        invoice.property?.name || '',
        invoice.createdAt,
      ]
        .map(csvEscape)
        .join(',')
    ),
    ...payments.map((payment) =>
      [
        'payment',
        payment.reference,
        payment.status,
        payment.amount,
        payment.customer?.name || '',
        '',
        payment.completedAt || payment.createdAt,
      ]
        .map(csvEscape)
        .join(',')
    ),
  ];

  return c.json({
    success: true,
    data: {
      downloadUrl: toDataUrl(lines.join('\n'), 'text/csv'),
    },
  });
});

app.get('/disbursements', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getOwnerScope(auth, repos);
  const invoices = enrichOwnerInvoices(scope);
  const payments = enrichOwnerPayments(scope, invoices);
  return c.json({ success: true, data: buildDisbursementData(scope, payments) });
});

app.get('/disbursements/:id/statement', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getOwnerScope(auth, repos);
  const invoices = enrichOwnerInvoices(scope);
  const payments = enrichOwnerPayments(scope, invoices);
  const { disbursements } = buildDisbursementData(scope, payments);
  const disbursement = disbursements.find((item) => item.id === c.req.param('id'));

  if (!disbursement) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Disbursement not found' } }, 404);
  }

  const statement = [
    `Reference: ${disbursement.reference}`,
    `Period: ${disbursement.period}`,
    `Property: ${disbursement.property?.name || 'Portfolio'}`,
    `Gross Collected: KES ${disbursement.breakdown.rentCollected.toLocaleString()}`,
    `Management Fees: KES ${disbursement.breakdown.managementFees.toLocaleString()}`,
    `Net Disbursement: KES ${disbursement.breakdown.netDisbursement.toLocaleString()}`,
  ].join('\n');

  return c.json({
    success: true,
    data: {
      downloadUrl: toDataUrl(statement),
    },
  });
});

app.get('/messaging/conversations', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const data = await listOwnerConversations(c, auth, repos);
  return c.json({ success: true, data });
});

app.get('/messaging/conversations/:id/messages', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getOwnerScope(auth, repos);
  const user = await repos.users.findById(auth.userId, auth.tenantId);
  const customerMap = new Map(scope.customers.map((customer) => [customer.id, customer]));
  const conversation = await repos.messaging.getConversation(c.req.param('id'), auth.tenantId);

  if (!conversation) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const rows = await repos.messaging.getMessages(conversation.id, { limit: 200, offset: 0 });
  const data = rows
    .slice()
    .reverse()
    .map((message) => {
      const customer = customerMap.get(message.senderId);
      const senderName = customer
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : message.senderId === auth.userId
        ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || auth.userId
        : message.senderId;

      return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderType: message.senderId === auth.userId ? 'owner' : customer ? 'manager' : 'system',
        senderName,
        content: message.content,
        status: message.readAt ? 'READ' : 'SENT',
        attachments: Array.isArray(message.attachments) ? message.attachments : [],
        readAt: message.readAt,
        createdAt: message.createdAt,
      };
    });

  return c.json({ success: true, data });
});

app.post('/messaging/conversations/:id/messages', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json();
  const conversation = await repos.messaging.getConversation(id, auth.tenantId);

  if (!conversation) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const message = await repos.messaging.createMessage({
    id: crypto.randomUUID(),
    conversationId: id,
    senderId: auth.userId,
    content: body.content,
    attachments: body.attachments || [],
  });

  await db
    .update(conversations)
    .set({
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    })
    .where(eq(conversations.id, id));

  return c.json({
    success: true,
    data: {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: 'owner',
      senderName: auth.userId,
      content: message.content,
      status: 'SENT',
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
      createdAt: message.createdAt,
    },
  });
});

app.get('/documents/signatures', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getOwnerScope(auth, repos);
  // Pending-signatures is a small working set; cap fetch at 500 and
  // filter in-memory. Move to repo-level filter when doc volume grows.
  const docs = (await repos.documents.findMany(auth.tenantId, { limit: 500, offset: 0 })).items;
  const propertyMap = new Map(scope.properties.map((property) => [property.id, property]));
  const unitMap = new Map(scope.units.map((unit) => [unit.id, unit]));
  const customerMap = new Map(scope.customers.map((customer) => [customer.id, customer]));

  const pending = docs
    .filter((doc) => ['lease_agreement', 'move_in_report', 'move_out_report'].includes(doc.documentType))
    .filter((doc) => !doc.metadata?.signedAt)
    .map((doc) => ({
      id: doc.id,
      name: doc.fileName,
      type: String(doc.documentType).toUpperCase(),
      category: doc.entityType || 'document',
      property: doc.metadata?.propertyId
        ? { id: doc.metadata.propertyId, name: propertyMap.get(doc.metadata.propertyId)?.name || doc.metadata.propertyId }
        : undefined,
      unit: doc.metadata?.unitId
        ? { id: doc.metadata.unitId, unitNumber: unitMap.get(doc.metadata.unitId)?.unitCode || doc.metadata.unitId }
        : undefined,
      customer: doc.customerId
        ? {
            id: doc.customerId,
            name:
              `${customerMap.get(doc.customerId)?.firstName || ''} ${
                customerMap.get(doc.customerId)?.lastName || ''
              }`.trim() || doc.customerId,
          }
        : undefined,
      signatureStatus: 'PENDING',
      expiresAt: doc.expiresAt,
      createdAt: doc.createdAt,
      size: doc.fileSize,
      previewUrl: doc.fileUrl,
    }));

  const history = docs
    .filter((doc) => doc.metadata?.signedAt)
    .map((doc) => ({
      id: `hist-${doc.id}`,
      documentName: doc.fileName,
      signedAt: doc.metadata.signedAt,
      signedBy: doc.metadata.signedBy || auth.userId,
      property: doc.metadata?.propertyId
        ? { id: doc.metadata.propertyId, name: propertyMap.get(doc.metadata.propertyId)?.name || doc.metadata.propertyId }
        : undefined,
      status: 'SIGNED',
      ipAddress: doc.metadata?.signedIp,
    }))
    .sort((left, right) => new Date(right.signedAt) - new Date(left.signedAt));

  return c.json({ success: true, data: { pending, history } });
});

app.post('/documents/:id/sign', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await repos.documents.findById(id, auth.tenantId);

  if (!existing) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404);
  }

  const metadata = {
    ...(existing.metadata || {}),
    signedAt: new Date().toISOString(),
    signedBy: auth.userId,
    signatureImage: body.signatureImage,
    agreedToTerms: Boolean(body.agreedToTerms),
  };

  const row = await repos.documents.update(id, auth.tenantId, {
    metadata,
    status: 'validated',
    verifiedAt: new Date(),
    verifiedBy: auth.userId,
    updatedBy: auth.userId,
  });

  return c.json({ success: true, data: { id: row.id, signedAt: metadata.signedAt } });
});

export const ownerPortalRouter = app;
