/**
 * Customer App BFF Routes - BOSSNYUMBA
 * 
 * Backend for Frontend routes optimized for residents/tenants:
 * - Profile and onboarding completion
 * - Lease documents and e-signatures
 * - Rent payments and payment history
 * - Maintenance request lifecycle
 * - Communication with management
 * - Notifications and alerts
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/hono-auth';
import { requireRole, requireOwnership } from '../../middleware/authorization';
import { UserRole } from '../../types/user-role';
import { getDataService } from '../../services/data-access.service';

// ============================================================================
// Schemas
// ============================================================================

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const onboardingProgressSchema = z.object({
  step: z.enum([
    'profile_completion',
    'id_verification',
    'lease_signing',
    'move_in_inspection',
    'utility_setup',
    'welcome_completion'
  ]),
  data: z.record(z.unknown()),
});

const createMaintenanceRequestSchema = z.object({
  category: z.enum([
    'plumbing', 'electrical', 'appliance', 'hvac', 'structural',
    'pest_control', 'security', 'cleaning', 'landscaping', 'other'
  ]),
  priority: z.enum(['low', 'medium', 'high', 'emergency']).default('medium'),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  location: z.string().min(1).max(200),
  permissionToEnter: z.boolean().default(false),
  entryInstructions: z.string().max(500).optional(),
  preferredSchedule: z.array(z.object({
    date: z.string(),
    timeSlot: z.string(),
  })).optional(),
});

const paymentInitiationSchema = z.object({
  invoiceId: z.string(),
  paymentMethod: z.enum(['mpesa', 'bank_transfer', 'card', 'cash']),
  amount: z.number().positive(),
  phone: z.string().optional(),
});

const sendMessageSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  category: z.enum(['general', 'maintenance', 'billing', 'complaint', 'suggestion']).optional(),
  attachments: z.array(z.string()).max(5).optional(),
});

const feedbackSchema = z.object({
  type: z.enum(['satisfaction', 'complaint', 'suggestion', 'compliment']),
  category: z.string(),
  rating: z.number().min(1).max(5).optional(),
  message: z.string().min(10).max(2000),
  anonymous: z.boolean().default(false),
});

const notificationPreferencesSchema = z.object({
  channels: z.object({
    whatsapp: z.boolean(),
    sms: z.boolean(),
    email: z.boolean(),
    push: z.boolean(),
  }),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
  categories: z.object({
    billing: z.boolean(),
    maintenance: z.boolean(),
    announcements: z.boolean(),
    community: z.boolean(),
  }),
});

// ============================================================================
// Router
// ============================================================================

export const customerAppRouter = new Hono()
  .use('*', authMiddleware)
  .use('*', requireRole(UserRole.RESIDENT, UserRole.TENANT_ADMIN, UserRole.PROPERTY_MANAGER));

// Dashboard & Home
customerAppRouter.get('/home', async (c) => {
  const auth = c.get('auth');
  const dataService = getDataService();

  // Fetch real profile data
  const profile = await dataService.getCustomerProfile(auth.userId);
  const invoices = await dataService.getCustomerInvoices(auth.userId, { page: 1, pageSize: 5 }, 'pending');
  const maintenance = await dataService.getCustomerMaintenanceRequests(auth.userId, { page: 1, pageSize: 5 });
  const notifications = await dataService.getNotifications(auth.userId, { page: 1, pageSize: 5 }, true);

  const pendingInvoices = invoices.data as Array<{ amount: number; dueDate: string; description: string }>;
  const openMaintenance = maintenance.data as Array<{ status: string }>;

  const homeData = {
    greeting: getTimeBasedGreeting(),
    customer: profile || { id: auth.userId },
    quickStats: {
      currentBalance: pendingInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
      nextPaymentDue: pendingInvoices[0]?.dueDate || null,
      nextPaymentAmount: pendingInvoices[0]?.amount || 0,
      openMaintenanceRequests: openMaintenance.filter((m) => !['completed', 'cancelled'].includes(m.status)).length,
    },
    alerts: notifications.data,
    recentActivity: [],
    announcements: [],
  };
  return c.json({ success: true, data: homeData });
});

// Profile & Onboarding
customerAppRouter.get('/profile', async (c) => {
  const auth = c.get('auth');
  const dataService = getDataService();
  const profile = await dataService.getCustomerProfile(auth.userId);

  if (!profile) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } }, 404);
  }

  return c.json({ success: true, data: profile });
});

customerAppRouter.put('/profile', zValidator('json', z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  emergencyContact: z.object({
    name: z.string().min(2).max(100),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
    relationship: z.string().min(2).max(50),
  }).optional(),
  preferences: z.object({
    language: z.enum(['en', 'sw']),
    preferredChannel: z.enum(['whatsapp', 'sms', 'email', 'app']),
  }).partial().optional(),
})), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const updatedProfile = { id: auth.userId, ...body, updatedAt: new Date().toISOString() };
  return c.json({ success: true, data: updatedProfile });
});

customerAppRouter.get('/onboarding', async (c) => {
  const onboarding = {
    currentStep: 'utility_setup',
    totalSteps: 6,
    completedSteps: 4,
    percentComplete: 67,
    steps: [
      { id: 'profile_completion', name: 'Complete Your Profile', description: 'Add your personal details and emergency contact', status: 'completed', completedAt: '2023-06-01T10:00:00Z' },
      { id: 'id_verification', name: 'Verify Your Identity', description: 'Upload your ID for verification', status: 'completed', completedAt: '2023-06-02T11:00:00Z' },
      { id: 'lease_signing', name: 'Sign Your Lease', description: 'Review and sign your lease agreement', status: 'completed', completedAt: '2023-06-03T09:00:00Z' },
      { id: 'move_in_inspection', name: 'Move-In Inspection', description: 'Complete the move-in inspection with photos', status: 'completed', completedAt: '2023-06-04T10:00:00Z' },
      { id: 'utility_setup', name: 'Set Up Utilities', description: 'Learn how to manage your utilities', status: 'in_progress', procedures: [{ id: 'tanesco_setup', name: 'TANESCO/LUKU Token Entry', completed: true }, { id: 'water_setup', name: 'Water Meter Reading', completed: false }] },
      { id: 'welcome_completion', name: 'Welcome Complete', description: 'You are all set! Explore your new home', status: 'pending' },
    ],
  };
  return c.json({ success: true, data: onboarding });
});

customerAppRouter.post('/onboarding/progress', zValidator('json', onboardingProgressSchema), async (c) => {
  const auth = c.get('auth');
  const { step, data } = c.req.valid('json');
  const progress = { userId: auth.userId, step, status: 'completed', completedAt: new Date().toISOString(), data };
  return c.json({ success: true, data: progress, message: 'Step "' + step + '" completed successfully' });
});

// Payments & Billing
customerAppRouter.get('/payments/balance', async (c) => {
  const auth = c.get('auth');
  const dataService = getDataService();
  const invoices = await dataService.getCustomerInvoices(auth.userId, { page: 1, pageSize: 100 }, 'pending');
  const payments = await dataService.getCustomerPayments(auth.userId, { page: 1, pageSize: 1 });

  const pendingAmount = (invoices.data as Array<{ amount: number }>).reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const lastPayment = (payments.data as Array<Record<string, unknown>>)[0] || null;

  const balance = {
    currentBalance: 0,
    pendingCharges: pendingAmount,
    nextPayment: invoices.data[0] || null,
    lastPayment,
  };
  return c.json({ success: true, data: balance });
});

customerAppRouter.get('/payments/invoices', zValidator('query', paginationSchema.merge(z.object({
  status: z.enum(['all', 'pending', 'paid', 'overdue', 'partial']).optional().default('all'),
}))), async (c) => {
  const auth = c.get('auth');
  const { page, pageSize, status } = c.req.valid('query');
  const dataService = getDataService();
  const result = await dataService.getCustomerInvoices(auth.userId, { page, pageSize }, status);
  return c.json({ success: true, data: result.data, pagination: result.pagination });
});

customerAppRouter.post('/payments/pay', zValidator('json', paymentInitiationSchema), async (c) => {
  const auth = c.get('auth');
  const { invoiceId, paymentMethod, amount, phone } = c.req.valid('json');
  const payment = { id: 'pay_' + Date.now(), invoiceId, amount, paymentMethod, status: 'initiated', initiatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
  if (paymentMethod === 'mpesa') {
    return c.json({ success: true, data: { ...payment, mpesa: { checkoutRequestId: 'ws_CO_' + Date.now(), merchantRequestId: 'MR-' + Date.now(), message: 'Please check your phone and enter your M-Pesa PIN', phone: phone || '+255700000001' } }, message: 'M-Pesa payment request sent. Check your phone.' }, 202);
  }
  if (paymentMethod === 'bank_transfer') {
    const tenant = c.get('tenant') as { settings?: { bankName?: string; bankAccount?: string; bankAccountName?: string; bankSwiftCode?: string } } | undefined;
    const bankDetails = {
      bankName: tenant?.settings?.bankName || process.env.BANK_NAME || '',
      accountNumber: tenant?.settings?.bankAccount || process.env.BANK_ACCOUNT_NUMBER || '',
      accountName: tenant?.settings?.bankAccountName || process.env.BANK_ACCOUNT_NAME || '',
      reference: 'RENT-' + auth.userId.slice(-6) + '-' + Date.now(),
      swiftCode: tenant?.settings?.bankSwiftCode || process.env.BANK_SWIFT_CODE || '',
    };
    return c.json({ success: true, data: { ...payment, bankDetails }, message: 'Please transfer to the provided bank account with the reference.' });
  }
  return c.json({ success: true, data: payment });
});

customerAppRouter.get('/payments/history', zValidator('query', paginationSchema), async (c) => {
  const auth = c.get('auth');
  const { page, pageSize } = c.req.valid('query');
  const dataService = getDataService();
  const result = await dataService.getCustomerPayments(auth.userId, { page, pageSize });
  return c.json({ success: true, data: result.data, pagination: result.pagination });
});

customerAppRouter.get('/payments/receipts/:id', async (c) => {
  const receiptId = c.req.param('id');
  const storageBaseUrl = process.env.STORAGE_BASE_URL || '/storage';
  return c.json({ success: true, data: { downloadUrl: `${storageBaseUrl}/receipts/${receiptId}?token=xxx`, expiresAt: new Date(Date.now() + 3600000).toISOString() } });
});

// Maintenance Requests
customerAppRouter.get('/maintenance', zValidator('query', paginationSchema.merge(z.object({
  status: z.enum(['all', 'open', 'in_progress', 'completed', 'cancelled']).optional().default('all'),
}))), async (c) => {
  const auth = c.get('auth');
  const { page, pageSize } = c.req.valid('query');
  const dataService = getDataService();
  const result = await dataService.getCustomerMaintenanceRequests(auth.userId, { page, pageSize });
  return c.json({ success: true, data: result.data, pagination: result.pagination });
});

customerAppRouter.get('/maintenance/:id', async (c) => {
  const requestId = c.req.param('id');
  const request = {
    id: requestId, ticketNumber: 'WO-2024-0150', category: 'plumbing', priority: 'medium', title: 'Leaking faucet in kitchen', description: 'Kitchen faucet is dripping constantly. Water is pooling under the sink.', location: 'Kitchen', status: 'in_progress', permissionToEnter: true, entryInstructions: 'Key with security guard', createdAt: '2024-02-25T10:00:00Z', lastUpdate: '2024-02-26T14:00:00Z', scheduledDate: '2024-02-28', scheduledTimeSlot: '14:00-16:00',
    assignedTo: { id: 'vendor-001', name: 'ABC Plumbing', phone: '+255700000003', rating: 4.5 },
    attachments: [{ id: 'att-001', type: 'image', url: '/attachments/maint-001-1.jpg', description: 'Photo of leak' }],
    timeline: [{ status: 'submitted', timestamp: '2024-02-25T10:00:00Z', message: 'Request submitted', actor: 'You' }, { status: 'triaged', timestamp: '2024-02-25T11:00:00Z', message: 'Issue categorized', actor: 'System' }, { status: 'assigned', timestamp: '2024-02-26T09:00:00Z', message: 'Assigned to ABC Plumbing', actor: 'Alice Manager' }, { status: 'scheduled', timestamp: '2024-02-26T14:00:00Z', message: 'Visit scheduled for Feb 28, 2-4pm', actor: 'ABC Plumbing' }],
    canCancel: true, canReschedule: true,
  };
  return c.json({ success: true, data: request });
});

customerAppRouter.post('/maintenance', zValidator('json', createMaintenanceRequestSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const dataService = getDataService();

  const request = await dataService.createMaintenanceRequest({
    customerId: auth.userId,
    category: body.category,
    priority: body.priority,
    title: body.title,
    description: body.description,
    location: body.location,
    permissionToEnter: body.permissionToEnter,
    entryInstructions: body.entryInstructions,
  });

  return c.json({
    success: true,
    data: { ...request as object, estimatedResponseTime: getEstimatedResponseTime(body.priority) },
    message: 'Maintenance request submitted successfully. You will be notified of updates.',
  }, 201);
});

customerAppRouter.post('/maintenance/:id/cancel', zValidator('json', z.object({ reason: z.string().min(1).max(500) })), async (c) => {
  const requestId = c.req.param('id');
  const { reason } = c.req.valid('json');
  return c.json({ success: true, data: { id: requestId, status: 'cancelled', cancelledAt: new Date().toISOString(), cancellationReason: reason }, message: 'Maintenance request cancelled' });
});

customerAppRouter.post('/maintenance/:id/confirm', zValidator('json', z.object({
  satisfied: z.boolean(), rating: z.number().min(1).max(5),
  feedback: z.string().max(1000).optional(), issueRemaining: z.boolean().default(false), issueDescription: z.string().max(500).optional(),
})), async (c) => {
  const requestId = c.req.param('id');
  const body = c.req.valid('json');
  if (!body.satisfied || body.issueRemaining) {
    return c.json({ success: true, data: { id: requestId, status: 'reopened', reopenedAt: new Date().toISOString(), reason: body.issueDescription || 'Issue not fully resolved' }, message: 'We are sorry the issue was not fully resolved. A follow-up has been scheduled.' });
  }
  return c.json({ success: true, data: { id: requestId, status: 'verified', verifiedAt: new Date().toISOString(), rating: body.rating, feedback: body.feedback }, message: 'Thank you for confirming completion!' });
});

// Documents & Lease
customerAppRouter.get('/documents', zValidator('query', paginationSchema.merge(z.object({
  type: z.enum(['all', 'lease', 'notice', 'receipt', 'inspection', 'rules']).optional().default('all'),
}))), async (c) => {
  const { page, pageSize } = c.req.valid('query');
  const documents = [
    { id: 'doc-001', type: 'lease', name: 'Lease Agreement - Unit A1', description: '12-month lease agreement', uploadedAt: '2023-06-01T00:00:00Z', size: 512000, format: 'pdf', requiresSignature: false, signed: true, signedAt: '2023-06-03T09:00:00Z', downloadUrl: '/api/customer/documents/doc-001/download' },
    { id: 'doc-002', type: 'inspection', name: 'Move-In Inspection Report', description: 'Condition report at move-in', uploadedAt: '2023-06-04T00:00:00Z', size: 2048000, format: 'pdf', downloadUrl: '/api/customer/documents/doc-002/download' },
    { id: 'doc-003', type: 'rules', name: 'House Rules & Regulations', description: 'Property rules and guidelines', uploadedAt: '2023-06-01T00:00:00Z', size: 256000, format: 'pdf', downloadUrl: '/api/customer/documents/doc-003/download' },
  ];
  return c.json({ success: true, data: documents, pagination: { page, pageSize, total: documents.length, totalPages: 1 } });
});

customerAppRouter.get('/documents/:id/download', async (c) => {
  const documentId = c.req.param('id');
  const storageBaseUrl = process.env.STORAGE_BASE_URL || '/storage';
  return c.json({ success: true, data: { downloadUrl: `${storageBaseUrl}/documents/${documentId}?token=xxx`, expiresAt: new Date(Date.now() + 3600000).toISOString() } });
});

customerAppRouter.get('/lease', async (c) => {
  const lease = {
    id: 'lease-001', leaseNumber: 'LSE-2023-0601-001', status: 'active',
    unit: { id: 'unit-001', number: 'A1', type: '2 Bedroom', floor: 2, size: 85 },
    property: { id: 'prop-001', name: 'Masaki Heights', address: 'Plot 123, Masaki, Dar es Salaam' },
    terms: { startDate: '2023-06-01', endDate: '2024-05-31', monthlyRent: 800000, securityDeposit: 1600000, depositStatus: 'held', paymentDueDay: 1, lateFeePercentage: 5, gracePeriodDays: 5 },
    renewal: { eligible: true, windowOpens: '2024-03-01', windowCloses: '2024-04-30', offers: null },
    contacts: { estateManager: { name: 'Alice Manager', phone: '+255700000001', email: 'alice@example.com' }, emergencyMaintenance: '+255700000099' },
  };
  return c.json({ success: true, data: lease });
});

customerAppRouter.post('/lease/renewal', zValidator('json', z.object({
  interested: z.boolean(), preferredTermMonths: z.number().min(6).max(24).optional(), comments: z.string().max(1000).optional(),
})), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const response = { id: 'renewal_' + Date.now(), customerId: auth.userId, interested: body.interested, preferredTermMonths: body.preferredTermMonths, submittedAt: new Date().toISOString(), status: 'pending_review' };
  return c.json({ success: true, data: response, message: body.interested ? 'Thank you for your interest in renewal! We will send you options soon.' : 'We have recorded your decision. Please remember to provide move-out notice 30 days before.' });
});

customerAppRouter.post('/lease/move-out-notice', zValidator('json', z.object({
  intendedMoveOutDate: z.string(), reason: z.string().min(10).max(1000),
  forwardingAddress: z.object({ street: z.string(), city: z.string(), country: z.string(), postalCode: z.string().optional() }).optional(),
})), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const notice = { id: 'notice_' + Date.now(), customerId: auth.userId, type: 'move_out', intendedMoveOutDate: body.intendedMoveOutDate, reason: body.reason, submittedAt: new Date().toISOString(), status: 'submitted', nextSteps: ['Confirmation will be sent within 24 hours', 'Move-out inspection will be scheduled', 'Cleaning and key return procedures will be shared', 'Deposit settlement will be processed after inspection'] };
  return c.json({ success: true, data: notice, message: 'Move-out notice submitted successfully. We will contact you with next steps.' });
});

// Communication
customerAppRouter.get('/messages', zValidator('query', paginationSchema), async (c) => {
  const { page, pageSize } = c.req.valid('query');
  const messages = [
    { id: 'msg-001', direction: 'inbound', from: { id: 'user-mgr-001', name: 'Alice Manager', role: 'estate_manager' }, subject: 'Welcome to Masaki Heights!', preview: 'Welcome to your new home! Here are some important things...', createdAt: '2023-06-01T10:00:00Z', read: true, hasAttachments: true },
    { id: 'msg-002', direction: 'outbound', to: { id: 'user-mgr-001', name: 'Alice Manager', role: 'estate_manager' }, subject: 'Question about parking', preview: 'Hi, I wanted to ask about guest parking...', createdAt: '2023-06-15T14:00:00Z', read: true, hasAttachments: false },
  ];
  return c.json({ success: true, data: messages, pagination: { page, pageSize, total: messages.length, totalPages: 1 } });
});

customerAppRouter.get('/messages/:id', async (c) => {
  const messageId = c.req.param('id');
  const message = {
    id: messageId, direction: 'inbound', from: { id: 'user-mgr-001', name: 'Alice Manager', role: 'estate_manager' }, subject: 'Welcome to Masaki Heights!',
    body: 'Dear John,\n\nWelcome to your new home at Masaki Heights! We are delighted to have you as part of our community.\n\nHere are some important things to help you settle in:\n\n1. Emergency Contacts\n   - Management: +255700000001\n   - Emergency Maintenance: +255700000099\n   - Security: +255700000088\n\n2. Utility Setup\n   - Your TANESCO/LUKU meter number is: 12345678\n   - Water account: WTR-A1-2023\n\n3. Community Guidelines\n   - Quiet hours: 10 PM - 7 AM\n   - Guest parking in designated areas only\n   - Waste collection: Monday & Thursday mornings\n\nPlease do not hesitate to reach out if you have any questions!\n\nBest regards,\nAlice Manager',
    createdAt: '2023-06-01T10:00:00Z', read: true,
    attachments: [{ id: 'att-001', name: 'Welcome_Pack.pdf', size: 256000, type: 'application/pdf' }], replies: [],
  };
  return c.json({ success: true, data: message });
});

customerAppRouter.post('/messages', zValidator('json', sendMessageSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const message = { id: 'msg_' + Date.now(), direction: 'outbound', from: { id: auth.userId }, subject: body.subject, body: body.body, category: body.category, attachments: body.attachments || [], createdAt: new Date().toISOString(), status: 'sent' };
  return c.json({ success: true, data: message, message: 'Message sent successfully' }, 201);
});

// Feedback & Satisfaction
customerAppRouter.post('/feedback', zValidator('json', feedbackSchema), async (c) => {
  const auth = c.get('auth');
  const body = c.req.valid('json');
  const feedback = { id: 'feedback_' + Date.now(), customerId: body.anonymous ? null : auth.userId, type: body.type, category: body.category, rating: body.rating, message: body.message, anonymous: body.anonymous, submittedAt: new Date().toISOString(), status: 'received' };
  return c.json({ success: true, data: feedback, message: 'Thank you for your feedback! We appreciate your input.' }, 201);
});

// Notifications
customerAppRouter.get('/notifications', zValidator('query', paginationSchema.merge(z.object({
  unreadOnly: z.coerce.boolean().optional().default(false),
}))), async (c) => {
  const auth = c.get('auth');
  const { page, pageSize, unreadOnly } = c.req.valid('query');
  const dataService = getDataService();
  const result = await dataService.getNotifications(auth.userId, { page, pageSize }, unreadOnly);
  const unreadCount = (result.data as Array<{ read: boolean }>).filter(n => !n.read).length;
  return c.json({ success: true, data: result.data, pagination: result.pagination, unreadCount });
});

customerAppRouter.post('/notifications/:id/read', async (c) => {
  const notificationId = c.req.param('id');
  return c.json({ success: true, data: { id: notificationId, read: true, readAt: new Date().toISOString() } });
});

customerAppRouter.post('/notifications/read-all', async (c) => {
  return c.json({ success: true, data: { markedRead: 5, timestamp: new Date().toISOString() }, message: 'All notifications marked as read' });
});

customerAppRouter.get('/notifications/preferences', async (c) => {
  const preferences = { channels: { whatsapp: true, sms: false, email: true, push: true }, quietHours: { enabled: true, start: '22:00', end: '07:00' }, categories: { billing: true, maintenance: true, announcements: true, community: false } };
  return c.json({ success: true, data: preferences });
});

customerAppRouter.put('/notifications/preferences', zValidator('json', notificationPreferencesSchema), async (c) => {
  const body = c.req.valid('json');
  return c.json({ success: true, data: body, message: 'Notification preferences updated' });
});

// Helpers
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getEstimatedResponseTime(priority: string): string {
  const times: Record<string, string> = { emergency: '1 hour', high: '4 hours', medium: '24 hours', low: '48 hours' };
  return times[priority] || '24 hours';
}

export default customerAppRouter;
