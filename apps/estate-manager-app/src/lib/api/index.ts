/**
 * Type-safe local wrappers around @bossnyumba/api-client services.
 *
 * These expose the domain-specific shapes the estate-manager-app UI renders.
 * The API client is expected to be initialized by ApiProvider before these
 * helpers are invoked.
 */

import {
  getApiClient,
  notificationsService,
  messagingService,
  schedulingService,
  reportsService,
  workOrdersService,
  vendorsService,
  inspectionsService,
  type Message,
  type Conversation,
  type ScheduleEvent,
} from '@bossnyumba/api-client';

// ─── Announcements ─────────────────────────────────────────────────
export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface AnnouncementListItem {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  publishedAt: string;
  expiresAt?: string;
  isPinned: boolean;
  property?: { id: string; name: string };
  author?: { id: string; name: string };
}

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  priority: AnnouncementPriority;
  propertyId?: string;
  publishNow?: boolean;
  publishAt?: string;
  expiresAt?: string;
  isPinned?: boolean;
}

export const announcementsApi = {
  async list(params?: { priority?: AnnouncementPriority; pinned?: boolean }) {
    const query: Record<string, string> = {};
    if (params?.priority) query.priority = params.priority;
    if (params?.pinned !== undefined) query.pinned = String(params.pinned);
    return getApiClient().get<AnnouncementListItem[]>('/announcements', query);
  },
  async get(id: string) {
    return getApiClient().get<AnnouncementListItem>(`/announcements/${id}`);
  },
  async create(request: CreateAnnouncementRequest) {
    return getApiClient().post<AnnouncementListItem>('/announcements', request);
  },
  async update(id: string, request: Partial<CreateAnnouncementRequest>) {
    return getApiClient().patch<AnnouncementListItem>(`/announcements/${id}`, request);
  },
  async remove(id: string) {
    return getApiClient().delete(`/announcements/${id}`);
  },
};

// ─── Notifications ────────────────────────────────────────────────
export interface NotificationListItem {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  category?: string;
  deepLinkUrl?: string;
}

export const notificationsApi = {
  async list() {
    return notificationsService.list();
  },
  async markRead(id: string) {
    return notificationsService.markAsRead(id);
  },
  async markAllRead() {
    return notificationsService.markAllAsRead();
  },
};

// ─── Messaging ────────────────────────────────────────────────────
export const messagingApi = {
  async listConversations(params?: { page?: number; pageSize?: number; unreadOnly?: boolean }) {
    return messagingService.listConversations(params);
  },
  async getConversation(id: string) {
    return messagingService.getConversation(id);
  },
  async listMessages(conversationId: string, params?: { page?: number; pageSize?: number }) {
    return messagingService.listMessages(conversationId, params);
  },
  async send(conversationId: string, content: string) {
    return messagingService.sendMessage(conversationId, { content });
  },
  async createConversation(participantId: string, subject: string, initialMessage: string) {
    return messagingService.createConversation({
      participantId,
      subject,
      initialMessage,
    });
  },
  async markRead(conversationId: string) {
    return messagingService.markAsRead(conversationId);
  },
};

export type { Message, Conversation };

// ─── Scheduling / Calendar ────────────────────────────────────────
export const schedulingApi = {
  async listEvents(params?: { startDate?: string; endDate?: string }) {
    return schedulingService.list(params);
  },
  async getCalendar(startDate: string, endDate: string) {
    return schedulingService.getCalendar(startDate, endDate);
  },
  async saveAvailability(availability: Record<string, string[]>) {
    return getApiClient().put<Record<string, string[]>>(
      '/scheduling/availability',
      { availability }
    );
  },
  async getAvailability() {
    return getApiClient().get<Record<string, string[]>>('/scheduling/availability');
  },
};

export type { ScheduleEvent };

// ─── Utilities (bills & readings) ─────────────────────────────────
export type BillStatus = 'paid' | 'pending' | 'overdue';
export type UtilityType = 'water' | 'electricity' | 'gas';

export interface UtilityBill {
  id: string;
  period: string;
  utilityType: UtilityType;
  property?: { id: string; name: string };
  unit?: { id: string; unitNumber: string };
  amount: number;
  status: BillStatus;
  dueDate: string;
  paidAt?: string;
}

export interface MeterReading {
  id: string;
  unit: { id: string; unitNumber: string };
  property?: { id: string; name: string };
  utilityType: UtilityType;
  previousReading: number;
  currentReading: number;
  consumption: number;
  unitLabel: string;
  recordedAt?: string;
  status: 'recorded' | 'pending';
}

export const utilitiesApi = {
  async listBills(params?: { status?: BillStatus; utilityType?: UtilityType }) {
    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    if (params?.utilityType) query.utilityType = params.utilityType;
    return getApiClient().get<UtilityBill[]>('/utilities/bills', query);
  },
  async listReadings(params?: { status?: 'recorded' | 'pending'; utilityType?: UtilityType }) {
    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    if (params?.utilityType) query.utilityType = params.utilityType;
    return getApiClient().get<MeterReading[]>('/utilities/readings', query);
  },
  async recordReading(request: {
    unitId: string;
    utilityType: UtilityType;
    currentReading: number;
    previousReading?: number;
    recordedAt?: string;
  }) {
    return getApiClient().post<MeterReading>('/utilities/readings', request);
  },
};

// ─── Reports (scheduled) ──────────────────────────────────────────
export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  frequency: ReportFrequency;
  recipients: string[];
  nextRun: string;
  createdAt: string;
}

export const reportsApi = {
  async listRecent() {
    return getApiClient().get<
      Array<{
        id: string;
        name: string;
        generatedAt: string;
        type: string;
        downloadUrl?: string;
      }>
    >('/reports/recent');
  },
  async listScheduled() {
    return getApiClient().get<ScheduledReport[]>('/reports/scheduled');
  },
  async createScheduled(request: {
    name: string;
    type: string;
    frequency: ReportFrequency;
    recipients: string[];
  }) {
    return getApiClient().post<ScheduledReport>('/reports/scheduled', request);
  },
  async deleteScheduled(id: string) {
    return getApiClient().delete(`/reports/scheduled/${id}`);
  },
  async getFinancial() {
    return reportsService.getFinancial();
  },
  async getOccupancy() {
    return reportsService.getOccupancy();
  },
  async getMaintenance() {
    return reportsService.getMaintenance();
  },
};

// ─── Payments (manager-recorded) ──────────────────────────────────
export interface RecordPaymentRequest {
  invoiceId?: string;
  customerId: string;
  amount: number;
  method: 'CASH' | 'MPESA' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD';
  reference?: string;
  notes?: string;
  receivedAt?: string;
}

export const paymentsApi = {
  async record(request: RecordPaymentRequest) {
    return getApiClient().post('/payments/record', request);
  },
  async listInvoicesForCustomer(customerId: string) {
    return getApiClient().get<Array<{ id: string; invoiceNumber: string; amountDue: number }>>(
      `/customers/${customerId}/invoices`,
      { status: 'UNPAID,PARTIAL' }
    );
  },
};

// ─── Vendors ──────────────────────────────────────────────────────
export interface CreateVendorPayload {
  name: string;
  companyName?: string;
  email: string;
  phone: string;
  categories: string[];
  hourlyRate?: number;
  callOutFee?: number;
  paymentTerms?: string;
  address?: string;
  isAvailable?: boolean;
}

export const vendorsApi = {
  list: vendorsService.list.bind(vendorsService),
  get: vendorsService.get.bind(vendorsService),
  async create(request: CreateVendorPayload) {
    return getApiClient().post('/vendors', request);
  },
  update: vendorsService.update.bind(vendorsService),
  remove: vendorsService.delete.bind(vendorsService),
};

// ─── Inspections ──────────────────────────────────────────────────
export interface InspectionItemPayload {
  area: string;
  item: string;
  condition: string;
  notes?: string;
  requiresAction: boolean;
  photoUrls?: string[];
}

export interface MeterReadingPayload {
  type: string;
  reading: number;
  unit: string;
  photoUrl?: string;
}

export interface InspectionDraftPayload {
  items: InspectionItemPayload[];
  meterReadings?: MeterReadingPayload[];
}

export interface InspectionCompletePayload {
  overallCondition: string;
  summary: string;
  items: InspectionItemPayload[];
  meterReadings?: MeterReadingPayload[];
  customerSignatureUrl?: string;
  inspectorSignatureUrl?: string;
  customerPresent?: boolean;
}

export const inspectionsApi = {
  get: inspectionsService.get.bind(inspectionsService),
  start: inspectionsService.start.bind(inspectionsService),
  complete: inspectionsService.complete.bind(inspectionsService),
  async saveDraft(id: string, payload: InspectionDraftPayload) {
    return getApiClient().patch(`/inspections/${id}/draft`, payload);
  },
  async uploadPhoto(id: string, file: File, areaLabel?: string) {
    const form = new FormData();
    form.append('file', file);
    if (areaLabel) form.append('area', areaLabel);
    const client = getApiClient() as unknown as {
      baseUrl: string;
      defaultHeaders?: Record<string, string>;
    };
    const baseUrl = (client.baseUrl ?? '').replace(/\/$/, '');
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${baseUrl}/inspections/${id}/photos`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }
    return (await response.json()) as { data?: { url: string }; url?: string };
  },
};

// ─── Users / Profile ──────────────────────────────────────────────
export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  avatarUrl?: string;
}

export const usersApi = {
  async me() {
    return getApiClient().get<UserProfile>('/users/me');
  },
  async updateProfile(payload: Partial<UserProfile>) {
    return getApiClient().patch<UserProfile>('/users/me', payload);
  },
  async changePassword(payload: { currentPassword: string; newPassword: string }) {
    return getApiClient().post('/users/me/password', payload);
  },
};

// ─── Work-order helpers ───────────────────────────────────────────
export interface WorkOrderAttachmentPayload {
  url: string;
  type: 'before' | 'after' | 'other';
  caption?: string;
}

export const workOrdersApi = {
  list: workOrdersService.list.bind(workOrdersService),
  get: workOrdersService.get.bind(workOrdersService),
  create: workOrdersService.create.bind(workOrdersService),
  update: workOrdersService.update.bind(workOrdersService),
  triage: workOrdersService.triage.bind(workOrdersService),
  assign: workOrdersService.assign.bind(workOrdersService),
  schedule: workOrdersService.schedule.bind(workOrdersService),
  startWork: workOrdersService.startWork.bind(workOrdersService),
  complete: workOrdersService.complete.bind(workOrdersService),
  pauseSLA: workOrdersService.pauseSLA.bind(workOrdersService),
  resumeSLA: workOrdersService.resumeSLA.bind(workOrdersService),
  escalate: workOrdersService.escalate.bind(workOrdersService),
  cancel: workOrdersService.cancel.bind(workOrdersService),
  async uploadAttachment(id: string, file: File, type: 'before' | 'after' | 'other' = 'other') {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    const client = getApiClient() as unknown as { baseUrl: string };
    const baseUrl = (client.baseUrl ?? '').replace(/\/$/, '');
    const token =
      typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${baseUrl}/work-orders/${id}/attachments`, {
      method: 'POST',
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    return (await response.json()) as { data?: { url: string } };
  },
  async signOff(
    id: string,
    payload: { tenantSignatureUrl: string; technicianSignatureUrl: string; notes?: string }
  ) {
    return getApiClient().post(`/work-orders/${id}/sign-off`, payload);
  },
};

// ─── Formatters ───────────────────────────────────────────────────
const DEFAULT_LOCALE = 'en-KE';
const DEFAULT_CURRENCY = 'KES';

export function formatCurrency(amount: number, currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
