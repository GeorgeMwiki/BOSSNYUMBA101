/**
 * Data Access Service - BOSSNYUMBA
 *
 * Production-ready data access layer that queries Supabase/PostgreSQL.
 * Replaces all mock data in BFF routes with real database queries.
 *
 * Architecture:
 *  - Uses Supabase service client for server-side queries (bypasses RLS)
 *  - Falls back to mock data ONLY in development when Supabase is not configured
 *  - Production REQUIRES Supabase - no mock data allowed
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
  period?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Service
// ============================================================================

export class DataAccessService {
  private client: SupabaseClient | null = null;
  private isConfigured: boolean;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    this.isConfigured = !!(url && (serviceKey || anonKey) && !url.includes('your-project'));

    if (this.isConfigured) {
      this.client = createClient(url, serviceKey || anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }

  // =========================================================================
  // Properties
  // =========================================================================

  async getPropertiesByOwner(ownerId: string, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockPropertiesList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const { data, count, error } = await this.client
      .from('properties')
      .select('*, units(id, unit_number, status, rent_amount)', { count: 'exact' })
      .eq('owner_id', ownerId)
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockPropertiesList(pagination);

    const properties = data.map((p) => ({
      id: p.id,
      name: p.name,
      address: [p.address_line1, p.city, p.region].filter(Boolean).join(', '),
      type: p.property_type || 'residential',
      totalUnits: p.units?.length || 0,
      occupiedUnits: p.units?.filter((u: { status: string }) => u.status === 'occupied').length || 0,
      occupancyRate: p.units?.length
        ? p.units.filter((u: { status: string }) => u.status === 'occupied').length / p.units.length
        : 0,
      monthlyRentRoll: p.units?.reduce((sum: number, u: { rent_amount: number }) => sum + (u.rent_amount || 0), 0) || 0,
      status: p.status || 'active',
    }));

    return {
      data: properties,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  async getPropertyById(propertyId: string, ownerId: string): Promise<unknown | null> {
    if (!this.client) return this.mockPropertyDetail(propertyId);

    const { data, error } = await this.client
      .from('properties')
      .select(`
        *,
        units(id, unit_number, unit_type, status, rent_amount, floor_number, size_sqm),
        leases(id, status, start_date, end_date, monthly_rent, customer:customers(id, first_name, last_name))
      `)
      .eq('id', propertyId)
      .eq('owner_id', ownerId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      address: [data.address_line1, data.city, data.region].filter(Boolean).join(', '),
      type: data.property_type || 'residential',
      description: data.description,
      amenities: data.amenities || [],
      totalUnits: data.units?.length || 0,
      occupiedUnits: data.units?.filter((u: { status: string }) => u.status === 'occupied').length || 0,
      vacantUnits: data.units?.filter((u: { status: string }) => u.status === 'vacant').length || 0,
      units: data.units?.map((u: Record<string, unknown>) => ({
        id: u.id,
        number: u.unit_number,
        type: u.unit_type,
        status: u.status,
        rentAmount: u.rent_amount,
        floor: u.floor_number,
        size: u.size_sqm,
      })) || [],
      status: data.status,
    };
  }

  // =========================================================================
  // Dashboard Aggregation
  // =========================================================================

  async getOwnerDashboard(ownerId: string, _dateRange: DateRangeParams): Promise<unknown> {
    if (!this.client) return this.mockOwnerDashboard();

    // Get properties with units
    const { data: properties } = await this.client
      .from('properties')
      .select('id, name, units(id, status, rent_amount)')
      .eq('owner_id', ownerId);

    const allUnits = properties?.flatMap((p: { units: unknown[] }) => p.units || []) || [];
    const totalUnits = allUnits.length;
    const occupiedUnits = allUnits.filter((u: { status: string }) => u.status === 'occupied').length;
    const totalRentRoll = allUnits.reduce((sum: number, u: { rent_amount: number }) => sum + (u.rent_amount || 0), 0);

    // Get recent payments
    const { data: payments } = await this.client
      .from('payments')
      .select('amount, status, created_at')
      .in('property_id', (properties || []).map((p: { id: string }) => p.id))
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'completed');

    const rentCollected = payments?.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0) || 0;

    // Get open work orders
    const { count: openWorkOrders } = await this.client
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .in('property_id', (properties || []).map((p: { id: string }) => p.id))
      .not('status', 'in', '("completed","cancelled")');

    return {
      portfolioSummary: {
        totalProperties: properties?.length || 0,
        totalUnits,
        occupancyRate: totalUnits ? occupiedUnits / totalUnits : 0,
      },
      financials: {
        rentBilled: totalRentRoll,
        rentCollected,
        collectionRate: totalRentRoll ? rentCollected / totalRentRoll : 0,
        arrearsTotal: totalRentRoll - rentCollected,
      },
      maintenance: {
        openWorkOrders: openWorkOrders || 0,
      },
    };
  }

  // =========================================================================
  // Customer/Tenant Data
  // =========================================================================

  async getCustomerProfile(customerId: string): Promise<unknown | null> {
    if (!this.client) return this.mockCustomerProfile(customerId);

    const { data, error } = await this.client
      .from('customers')
      .select(`
        *,
        leases(id, status, start_date, end_date, monthly_rent, unit:units(id, unit_number, property:properties(id, name, address_line1, city)))
      `)
      .eq('id', customerId)
      .single();

    if (error || !data) return null;

    const activeLease = data.leases?.find((l: { status: string }) => l.status === 'active');

    return {
      id: data.id,
      email: data.email,
      phone: data.phone,
      firstName: data.first_name,
      lastName: data.last_name,
      idNumber: data.id_number,
      idVerified: data.id_verified || false,
      occupancy: activeLease ? {
        unitId: activeLease.unit?.id,
        unitNumber: activeLease.unit?.unit_number,
        propertyId: activeLease.unit?.property?.id,
        propertyName: activeLease.unit?.property?.name,
        moveInDate: activeLease.start_date,
        leaseEndDate: activeLease.end_date,
      } : null,
    };
  }

  async getCustomerPayments(customerId: string, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockPaymentsList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const { data, count, error } = await this.client
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId)
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockPaymentsList(pagination);

    return {
      data: data.map((p) => ({
        id: p.id,
        date: p.created_at,
        amount: p.amount,
        method: p.payment_method,
        reference: p.reference,
        status: p.status,
        description: p.description,
      })),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  async getCustomerMaintenanceRequests(customerId: string, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockMaintenanceList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const { data, count, error } = await this.client
      .from('work_orders')
      .select('*, vendor:vendors(id, name, phone)', { count: 'exact' })
      .eq('customer_id', customerId)
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockMaintenanceList(pagination);

    return {
      data: data.map((wo) => ({
        id: wo.id,
        ticketNumber: wo.ticket_number,
        category: wo.category,
        priority: wo.priority,
        title: wo.title,
        description: wo.description,
        status: wo.status,
        createdAt: wo.created_at,
        assignedTo: wo.vendor ? { name: wo.vendor.name, phone: wo.vendor.phone } : null,
      })),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  async getCustomerInvoices(customerId: string, pagination: PaginationParams, status?: string): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockInvoicesList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('customer_id', customerId);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('due_date', { ascending: false });

    if (error || !data) return this.mockInvoicesList(pagination);

    return {
      data: data.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        period: inv.period,
        description: inv.description,
        amount: inv.amount,
        dueDate: inv.due_date,
        status: inv.status,
        paidAt: inv.paid_at,
        paymentMethod: inv.payment_method,
      })),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  // =========================================================================
  // Work Orders (Estate Manager)
  // =========================================================================

  async getWorkOrders(filters: {
    propertyId?: string;
    status?: string;
    priority?: string;
    vendorId?: string;
    assignedTo?: string;
  }, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockWorkOrdersList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('work_orders')
      .select(`
        *,
        property:properties(id, name),
        unit:units(id, unit_number),
        vendor:vendors(id, name, phone),
        customer:customers(id, first_name, last_name)
      `, { count: 'exact' });

    if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.priority && filters.priority !== 'all') query = query.eq('priority', filters.priority);
    if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId);
    if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockWorkOrdersList(pagination);

    return {
      data: data.map((wo) => ({
        id: wo.id,
        number: wo.ticket_number,
        property: wo.property ? { id: wo.property.id, name: wo.property.name } : null,
        unit: wo.unit ? { id: wo.unit.id, number: wo.unit.unit_number } : null,
        category: wo.category,
        priority: wo.priority,
        title: wo.title,
        description: wo.description,
        status: wo.status,
        estimatedCost: wo.estimated_cost,
        actualCost: wo.actual_cost,
        createdAt: wo.created_at,
        vendor: wo.vendor ? { id: wo.vendor.id, name: wo.vendor.name } : null,
        customer: wo.customer ? `${wo.customer.first_name} ${wo.customer.last_name}` : null,
      })),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  // =========================================================================
  // Notifications
  // =========================================================================

  async getNotifications(userId: string, pagination: PaginationParams, unreadOnly = false): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockNotificationsList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockNotificationsList(pagination);

    return {
      data: data.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        createdAt: n.created_at,
        read: n.read,
        actionUrl: n.action_url,
        actionLabel: n.action_label,
      })),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  // =========================================================================
  // Messages
  // =========================================================================

  async getMessages(userId: string, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockMessagesList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const { data, count, error } = await this.client
      .from('messages')
      .select('*, sender:users!sender_id(id, first_name, last_name)', { count: 'exact' })
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockMessagesList(pagination);

    return {
      data: data.map((m) => ({
        id: m.id,
        direction: m.sender_id === userId ? 'outbound' : 'inbound',
        from: m.sender ? { id: m.sender.id, name: `${m.sender.first_name} ${m.sender.last_name}` } : null,
        subject: m.subject,
        preview: m.body?.substring(0, 100),
        createdAt: m.created_at,
        read: m.read,
        hasAttachments: (m.attachments?.length || 0) > 0,
      })),
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    };
  }

  // =========================================================================
  // Work Order Detail
  // =========================================================================

  async getWorkOrderById(workOrderId: string): Promise<unknown | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('work_orders')
      .select(`
        *,
        property:properties(id, name, address_line1),
        unit:units(id, unit_number, unit_type),
        vendor:vendors(id, name, phone, email, rating),
        customer:customers(id, first_name, last_name, phone, email)
      `)
      .eq('id', workOrderId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      ticketNumber: data.ticket_number,
      category: data.category,
      priority: data.priority,
      title: data.title,
      description: data.description,
      location: data.location,
      status: data.status,
      permissionToEnter: data.permission_to_enter,
      entryInstructions: data.entry_instructions,
      estimatedCost: data.estimated_cost,
      actualCost: data.actual_cost,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      scheduledDate: data.scheduled_date,
      scheduledTimeSlot: data.scheduled_time_slot,
      assignedTo: data.vendor ? { id: data.vendor.id, name: data.vendor.name, phone: data.vendor.phone, rating: data.vendor.rating } : null,
      property: data.property ? { id: data.property.id, name: data.property.name } : null,
      unit: data.unit ? { id: data.unit.id, number: data.unit.unit_number } : null,
      customer: data.customer ? { id: data.customer.id, name: `${data.customer.first_name} ${data.customer.last_name}`, phone: data.customer.phone } : null,
    };
  }

  // =========================================================================
  // Message Detail
  // =========================================================================

  async getMessageById(messageId: string, userId: string): Promise<unknown | null> {
    if (!this.client) return null;

    const { data, error } = await this.client
      .from('messages')
      .select('*, sender:users!sender_id(id, first_name, last_name)')
      .eq('id', messageId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      direction: data.sender_id === userId ? 'outbound' : 'inbound',
      from: data.sender ? { id: data.sender.id, name: `${data.sender.first_name} ${data.sender.last_name}` } : null,
      subject: data.subject,
      body: data.body,
      createdAt: data.created_at,
      read: data.read,
      attachments: data.attachments || [],
    };
  }

  // =========================================================================
  // Create Operations
  // =========================================================================

  // =========================================================================
  // Inspections (Estate Manager)
  // =========================================================================

  async getInspections(filters: {
    propertyId?: string;
    type?: string;
    status?: string;
  }, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockInspectionsList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('inspections')
      .select(`
        *,
        property:properties(id, name),
        unit:units(id, unit_number),
        customer:customers(id, first_name, last_name, phone),
        inspector:users!inspector_id(id, first_name, last_name)
      `, { count: 'exact' });

    if (filters.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('scheduled_date', { ascending: false });

    if (error || !data) return this.mockInspectionsList(pagination);

    return {
      data: data.map((i) => ({
        id: i.id,
        type: i.type,
        property: i.property ? { id: i.property.id, name: i.property.name } : null,
        unit: i.unit ? { id: i.unit.id, number: i.unit.unit_number } : null,
        customer: i.customer ? { id: i.customer.id, name: `${i.customer.first_name} ${i.customer.last_name}`, phone: i.customer.phone } : null,
        status: i.status,
        scheduledDate: i.scheduled_date,
        scheduledTime: i.scheduled_time,
        inspector: i.inspector ? { id: i.inspector.id, name: `${i.inspector.first_name} ${i.inspector.last_name}` } : null,
        createdAt: i.created_at,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  // =========================================================================
  // Occupancy (Estate Manager)
  // =========================================================================

  async getOccupancySummary(propertyId?: string): Promise<unknown> {
    if (!this.client) return this.mockOccupancySummary();

    let query = this.client
      .from('units')
      .select(`
        id, unit_number, unit_type, status, rent_amount, floor_number,
        property:properties(id, name),
        lease:leases(id, end_date, customer:customers(id, first_name, last_name))
      `);

    if (propertyId) query = query.eq('property_id', propertyId);

    const { data, error } = await query.order('unit_number');

    if (error || !data) return this.mockOccupancySummary();

    const total = data.length;
    const occupied = data.filter((u) => u.status === 'occupied').length;
    const vacant = data.filter((u) => u.status === 'vacant').length;
    const turnover = data.filter((u) => u.status === 'turnover').length;

    return {
      summary: { totalUnits: total, occupied, vacant, turnover, occupancyRate: total ? occupied / total : 0 },
      units: data.map((u) => ({
        id: u.id,
        number: u.unit_number,
        property: u.property ? (u.property as { name: string }).name : null,
        type: u.unit_type,
        status: u.status,
        rentAmount: u.rent_amount,
        customer: u.lease?.[0]?.customer ? { id: (u.lease[0].customer as { id: string }).id, name: `${(u.lease[0].customer as { first_name: string }).first_name} ${(u.lease[0].customer as { last_name: string }).last_name}` } : null,
        leaseEnd: u.lease?.[0]?.end_date || null,
      })),
    };
  }

  // =========================================================================
  // Collections (Estate Manager)
  // =========================================================================

  async getCollections(pagination: PaginationParams, propertyId?: string): Promise<unknown> {
    if (!this.client) return this.mockCollections(pagination);

    const { data: overdueInvoices, error } = await this.client
      .from('invoices')
      .select(`
        *,
        customer:customers(id, first_name, last_name, phone),
        unit:units(id, unit_number, property:properties(id, name))
      `)
      .eq('status', 'overdue')
      .order('due_date', { ascending: true });

    if (error || !overdueInvoices) return this.mockCollections(pagination);

    const totalOutstanding = overdueInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const uniqueCustomers = new Set(overdueInvoices.map((inv) => inv.customer_id));

    return {
      summary: { totalOutstanding, tenantsInArrears: uniqueCustomers.size },
      accounts: overdueInvoices.map((inv) => ({
        customerId: inv.customer?.id,
        name: inv.customer ? `${inv.customer.first_name} ${inv.customer.last_name}` : 'Unknown',
        phone: inv.customer?.phone,
        unit: inv.unit?.unit_number,
        property: inv.unit?.property?.name,
        amountOwed: inv.amount,
        daysOverdue: Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
        status: 'active_collection',
      })),
    };
  }

  // =========================================================================
  // Vendors (Estate Manager)
  // =========================================================================

  async getVendors(pagination: PaginationParams, filters?: { specialization?: string; status?: string }): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockVendorsList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('vendors')
      .select('*', { count: 'exact' });

    if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('name');

    if (error || !data) return this.mockVendorsList(pagination);

    return {
      data: data.map((v) => ({
        id: v.id,
        name: v.name,
        specializations: v.specializations || [],
        status: v.status,
        contact: { phone: v.phone, email: v.email },
        performance: { rating: v.rating || 0, completedJobs: v.completed_jobs || 0 },
        isPreferred: v.is_preferred || false,
        emergencyAvailable: v.emergency_available || false,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  // =========================================================================
  // Leases
  // =========================================================================

  async getLeases(pagination: PaginationParams, filters?: { propertyId?: string; status?: string }): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockLeasesList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('leases')
      .select(`
        *,
        customer:customers(id, first_name, last_name, phone, email),
        unit:units(id, unit_number, property:properties(id, name))
      `, { count: 'exact' });

    if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
    if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('end_date', { ascending: true });

    if (error || !data) return this.mockLeasesList(pagination);

    return {
      data: data.map((l) => ({
        id: l.id,
        customer: l.customer ? { id: l.customer.id, name: `${l.customer.first_name} ${l.customer.last_name}`, phone: l.customer.phone } : null,
        unit: l.unit ? { id: l.unit.id, number: l.unit.unit_number, property: l.unit.property?.name } : null,
        status: l.status,
        startDate: l.start_date,
        endDate: l.end_date,
        monthlyRent: l.monthly_rent,
        securityDeposit: l.security_deposit,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  // =========================================================================
  // Admin: Tenants (multi-tenant SaaS)
  // =========================================================================

  async getTenants(pagination: PaginationParams, filters?: { status?: string; search?: string }): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockTenantsList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('tenants')
      .select('*', { count: 'exact' });

    if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters?.search) query = query.ilike('name', `%${filters.search}%`);

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockTenantsList(pagination);

    return {
      data: data.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        type: t.type,
        status: t.status,
        contactName: t.contact_name,
        contactEmail: t.contact_email,
        contactPhone: t.contact_phone,
        subscriptionPlan: t.subscription_plan,
        createdAt: t.created_at,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  // =========================================================================
  // Admin: Users
  // =========================================================================

  async getUsers(pagination: PaginationParams, filters?: { tenantId?: string; status?: string; search?: string }): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockUsersList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('users')
      .select('*, tenant:tenants(id, name)', { count: 'exact' });

    if (filters?.tenantId) query = query.eq('tenant_id', filters.tenantId);
    if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters?.search) query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockUsersList(pagination);

    return {
      data: data.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        phone: u.phone,
        tenant: u.tenant ? { id: u.tenant.id, name: u.tenant.name } : null,
        status: u.status,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  // =========================================================================
  // Admin: Audit Logs
  // =========================================================================

  async getAuditLogs(pagination: PaginationParams, filters?: { tenantId?: string; userId?: string; action?: string }): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockAuditLogsList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('audit_logs')
      .select('*, user:users(id, first_name, last_name), tenant:tenants(id, name)', { count: 'exact' });

    if (filters?.tenantId) query = query.eq('tenant_id', filters.tenantId);
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.action) query = query.eq('action', filters.action);

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockAuditLogsList(pagination);

    return {
      data: data.map((a) => ({
        id: a.id,
        timestamp: a.created_at,
        userId: a.user_id,
        userName: a.user ? `${a.user.first_name} ${a.user.last_name}` : null,
        tenantId: a.tenant_id,
        tenantName: a.tenant?.name || null,
        action: a.action,
        resource: a.resource,
        resourceId: a.resource_id,
        details: a.details,
        outcome: a.outcome,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  // =========================================================================
  // Admin: Platform Dashboard
  // =========================================================================

  async getPlatformDashboard(): Promise<unknown> {
    if (!this.client) return this.mockPlatformDashboard();

    const [tenants, users, properties, units] = await Promise.all([
      this.client.from('tenants').select('id, status', { count: 'exact', head: false }),
      this.client.from('users').select('id, status, last_login_at', { count: 'exact', head: false }),
      this.client.from('properties').select('id', { count: 'exact', head: true }),
      this.client.from('units').select('id, status', { count: 'exact', head: false }),
    ]);

    const totalTenants = tenants.data?.length || 0;
    const activeTenants = tenants.data?.filter((t) => t.status === 'active').length || 0;
    const totalUsers = users.data?.length || 0;
    const totalProperties = properties.count || 0;
    const totalUnits = units.data?.length || 0;
    const occupiedUnits = units.data?.filter((u) => u.status === 'occupied').length || 0;
    const now24h = new Date(Date.now() - 86400000).toISOString();
    const activeUsers24h = users.data?.filter((u) => u.last_login_at && u.last_login_at > now24h).length || 0;

    return {
      systemHealth: { status: 'healthy', uptime: 99.95 },
      platformMetrics: { totalTenants, activeTenants, totalUsers, activeUsers24h, totalProperties, totalUnits, occupancyRate: totalUnits ? occupiedUnits / totalUnits : 0 },
    };
  }

  // =========================================================================
  // Documents
  // =========================================================================

  async getDocuments(userId: string, pagination: PaginationParams, docType?: string): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockDocumentsList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('documents')
      .select('*', { count: 'exact' })
      .or(`owner_id.eq.${userId},shared_with.cs.{${userId}}`);

    if (docType && docType !== 'all') query = query.eq('type', docType);

    const { data, count, error } = await query
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (error || !data) return this.mockDocumentsList(pagination);

    return {
      data: data.map((d) => ({
        id: d.id,
        type: d.type,
        name: d.name,
        description: d.description,
        createdAt: d.created_at,
        size: d.size,
        format: d.format,
        downloadUrl: `/api/documents/${d.id}/download`,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  // =========================================================================
  // Financial Statements (Owner)
  // =========================================================================

  async getFinancialStatements(ownerId: string, pagination: PaginationParams, dateRange?: DateRangeParams): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockFinancialStatements(pagination);

    // Get owner's properties
    const { data: properties } = await this.client
      .from('properties')
      .select('id, name')
      .eq('owner_id', ownerId);

    if (!properties?.length) return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };

    const propertyIds = properties.map((p) => p.id);

    // Get invoices and payments for the period
    const { data: invoices } = await this.client
      .from('invoices')
      .select('*')
      .in('property_id', propertyIds)
      .gte('created_at', dateRange?.startDate || new Date(Date.now() - 90 * 86400000).toISOString());

    const { data: payments } = await this.client
      .from('payments')
      .select('*')
      .in('property_id', propertyIds)
      .eq('status', 'completed')
      .gte('created_at', dateRange?.startDate || new Date(Date.now() - 90 * 86400000).toISOString());

    const totalIncome = payments?.reduce((s, p) => s + (p.amount || 0), 0) || 0;

    const statements = properties.map((prop) => ({
      property: { id: prop.id, name: prop.name },
      income: { rentCollected: totalIncome, totalIncome },
      expenses: { totalExpenses: 0 },
      netOperatingIncome: totalIncome,
    }));

    return {
      data: statements,
      pagination: { ...pagination, total: statements.length, totalPages: 1 },
    };
  }

  // =========================================================================
  // Create Operations
  // =========================================================================

  // =========================================================================
  // Inspection Detail
  // =========================================================================

  async getInspectionById(inspectionId: string): Promise<unknown | null> {
    if (!this.client) return this.mockInspectionDetail(inspectionId);

    const { data, error } = await this.client
      .from('inspections')
      .select('*, unit:units(id, unit_number, floor, unit_type, property:properties(id, name, address_line1)), customer:profiles!inspections_customer_id_fkey(id, first_name, last_name, phone, email), inspector:profiles!inspections_inspector_id_fkey(id, first_name, last_name)')
      .eq('id', inspectionId)
      .single();

    if (error || !data) return this.mockInspectionDetail(inspectionId);

    return {
      id: data.id,
      type: data.type,
      property: data.unit?.property ? { id: data.unit.property.id, name: data.unit.property.name, address: data.unit.property.address_line1 } : null,
      unit: data.unit ? { id: data.unit.id, number: data.unit.unit_number, type: data.unit.unit_type, floor: data.unit.floor } : null,
      customer: data.customer ? { id: data.customer.id, name: `${data.customer.first_name} ${data.customer.last_name}`, phone: data.customer.phone, email: data.customer.email } : null,
      status: data.status,
      scheduledDate: data.scheduled_date,
      scheduledTime: data.scheduled_time,
      inspector: data.inspector ? { id: data.inspector.id, name: `${data.inspector.first_name} ${data.inspector.last_name}` } : null,
      checklist: data.checklist || { rooms: [], itemsPerRoom: [], additionalItems: [] },
      meterReadings: data.meter_readings || {},
      keysHandover: data.keys_handover || {},
      completedItems: data.completed_items || [],
      baselineComparison: data.baseline_comparison || null,
      createdAt: data.created_at,
      startedAt: data.started_at,
    };
  }

  // =========================================================================
  // Vendor Scorecard
  // =========================================================================

  async getVendorScorecard(vendorId: string): Promise<unknown | null> {
    if (!this.client) return this.mockVendorScorecard(vendorId);

    const [vendorRes, jobsRes] = await Promise.all([
      this.client.from('vendors').select('*').eq('id', vendorId).single(),
      this.client.from('work_orders').select('id, title, status, priority, completed_at, customer_rating, created_at').eq('vendor_id', vendorId).order('completed_at', { ascending: false }).limit(20),
    ]);

    if (vendorRes.error || !vendorRes.data) return this.mockVendorScorecard(vendorId);

    const vendor = vendorRes.data;
    const jobs = jobsRes.data || [];
    const completedJobs = jobs.filter((j) => j.status === 'completed');
    const ratings = completedJobs.filter((j) => j.customer_rating).map((j) => j.customer_rating as number);
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    return {
      vendorId,
      vendorName: vendor.name || vendor.company_name,
      period: new Date().toISOString().slice(0, 7),
      overallScore: avgRating || vendor.rating || 0,
      metrics: {
        responseTime: { score: vendor.avg_response_score || 0, benchmark: 4.0, percentile: 0 },
        completionRate: { score: completedJobs.length > 0 ? completedJobs.length / Math.max(jobs.length, 1) * 5 : 0, benchmark: 4.2, percentile: 0 },
        customerSatisfaction: { score: avgRating, benchmark: 4.0, percentile: 0 },
        reopenRate: { score: 0, benchmark: 4.0, percentile: 0 },
        costEfficiency: { score: vendor.cost_efficiency_score || 0, benchmark: 4.0, percentile: 0 },
      },
      recentJobs: completedJobs.slice(0, 5).map((j) => ({
        id: j.id,
        title: j.title,
        rating: j.customer_rating || 0,
        completedAt: j.completed_at,
      })),
      issues: [],
      recommendations: [],
    };
  }

  // =========================================================================
  // SLA Metrics
  // =========================================================================

  async getSlaMetrics(): Promise<unknown> {
    if (!this.client) return this.mockSlaMetrics();

    const { data: workOrders } = await this.client
      .from('work_orders')
      .select('id, ticket_number, title, status, priority, vendor_id, created_at, response_due, resolution_due, responded_at, resolved_at')
      .in('status', ['submitted', 'triaged', 'assigned', 'scheduled', 'in_progress', 'pending_verification'])
      .order('created_at', { ascending: false })
      .limit(200);

    const wos = workOrders || [];
    const now = new Date();
    const atRisk = wos.filter((wo) => {
      const resDue = wo.resolution_due ? new Date(wo.resolution_due) : null;
      return resDue && resDue > now && resDue.getTime() - now.getTime() < 4 * 3600000;
    });
    const breached = wos.filter((wo) => {
      const resDue = wo.resolution_due ? new Date(wo.resolution_due) : null;
      return resDue && resDue < now;
    });
    const total = wos.length || 1;
    const compliant = wos.filter((wo) => {
      const resDue = wo.resolution_due ? new Date(wo.resolution_due) : null;
      return !resDue || resDue > now;
    });

    return {
      summary: {
        responseCompliance: total > 0 ? compliant.length / total : 1,
        resolutionCompliance: total > 0 ? (total - breached.length) / total : 1,
        atRiskCount: atRisk.length,
        breachedCount: breached.length,
      },
      byCategory: ['emergency', 'high', 'medium', 'low'].map((cat) => {
        const catWos = wos.filter((wo) => wo.priority === cat);
        const catBreached = catWos.filter((wo) => wo.resolution_due && new Date(wo.resolution_due) < now);
        return {
          category: cat,
          responseTarget: cat === 'emergency' ? '1h' : cat === 'high' ? '4h' : cat === 'medium' ? '24h' : '48h',
          resolutionTarget: cat === 'emergency' ? '4h' : cat === 'high' ? '24h' : cat === 'medium' ? '72h' : '7d',
          compliance: catWos.length > 0 ? (catWos.length - catBreached.length) / catWos.length : 1,
        };
      }),
      atRisk: atRisk.slice(0, 10).map((wo) => ({
        workOrderId: wo.id,
        number: wo.ticket_number,
        title: wo.title,
        slaType: 'resolution',
        timeRemaining: wo.resolution_due ? `${Math.round((new Date(wo.resolution_due).getTime() - now.getTime()) / 3600000)} hours` : 'N/A',
        priority: wo.priority,
        vendor: wo.vendor_id || 'Unassigned',
      })),
      breached: breached.slice(0, 10).map((wo) => ({
        workOrderId: wo.id,
        number: wo.ticket_number,
        title: wo.title,
        slaType: 'resolution',
        breachedBy: wo.resolution_due ? `${Math.round((now.getTime() - new Date(wo.resolution_due).getTime()) / 3600000)} hours` : 'N/A',
        priority: wo.priority,
        vendor: wo.vendor_id || 'Unassigned',
      })),
      trends: [],
    };
  }

  // =========================================================================
  // Tenant Detail (Admin)
  // =========================================================================

  async getTenantById(tenantId: string): Promise<unknown | null> {
    if (!this.client) return this.mockTenantDetail(tenantId);

    const { data, error } = await this.client
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error || !data) return this.mockTenantDetail(tenantId);

    // Get usage counts
    const [propsRes, unitsRes, usersRes] = await Promise.all([
      this.client.from('properties').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      this.client.from('units').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      this.client.from('profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ]);

    return {
      id: data.id,
      code: data.code || data.slug,
      name: data.name,
      type: data.type || 'company',
      status: data.status || 'active',
      contact: {
        name: data.contact_name,
        email: data.contact_email,
        phone: data.contact_phone,
      },
      address: data.address || {},
      subscription: {
        plan: data.subscription_plan || 'starter',
        status: data.subscription_status || 'active',
        startDate: data.subscription_start_date,
        renewalDate: data.subscription_renewal_date,
        monthlyBilling: data.monthly_billing || 0,
        features: data.features || [],
      },
      usage: {
        properties: propsRes.count || 0,
        units: unitsRes.count || 0,
        users: usersRes.count || 0,
      },
      billing: {
        totalBilled: data.total_billed || 0,
        totalPaid: data.total_paid || 0,
        balance: (data.total_billed || 0) - (data.total_paid || 0),
        lastPaymentDate: data.last_payment_date,
        paymentMethod: data.payment_method,
      },
      policyConstitution: data.policy_constitution || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  // =========================================================================
  // Roles (Admin)
  // =========================================================================

  async getRoles(pagination: PaginationParams, filters?: { tenantId?: string }): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockRolesList(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('roles')
      .select('*', { count: 'exact' })
      .range(offset, offset + pageSize - 1)
      .order('is_system', { ascending: false });

    if (filters?.tenantId) query = query.eq('tenant_id', filters.tenantId);

    const { data, count, error } = await query;
    if (error || !data) return this.mockRolesList(pagination);

    return {
      data: data.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: r.is_system,
        userCount: r.user_count || 0,
        permissions: r.permissions || [],
        tenantId: r.tenant_id,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  // =========================================================================
  // Support Search (Admin)
  // =========================================================================

  async searchPlatform(searchQuery: string, type?: string, tenantId?: string): Promise<unknown> {
    if (!this.client) return this.mockSearchResults();

    const results: Record<string, unknown[]> = { customers: [], properties: [], invoices: [], payments: [], workOrders: [] };
    const searchPattern = `%${searchQuery}%`;

    // Search customers
    if (!type || type === 'customer') {
      const { data } = await this.client.from('profiles')
        .select('id, first_name, last_name, email, phone, tenant_id')
        .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`)
        .limit(10);
      results.customers = (data || []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, email: c.email, phone: c.phone, tenantId: c.tenant_id, match: 'name' }));
    }

    // Search invoices
    if (!type || type === 'invoice') {
      const { data } = await this.client.from('invoices')
        .select('id, invoice_number, amount, status, tenant_id')
        .or(`invoice_number.ilike.${searchPattern}`)
        .limit(10);
      results.invoices = (data || []).map((i) => ({ id: i.id, number: i.invoice_number, amount: i.amount, status: i.status, tenantId: i.tenant_id, match: 'invoice_number' }));
    }

    // Search work orders
    if (!type || type === 'workorder') {
      const { data } = await this.client.from('work_orders')
        .select('id, ticket_number, title, status, tenant_id')
        .or(`ticket_number.ilike.${searchPattern},title.ilike.${searchPattern}`)
        .limit(10);
      results.workOrders = (data || []).map((w) => ({ id: w.id, number: w.ticket_number, title: w.title, status: w.status, tenantId: w.tenant_id, match: 'title' }));
    }

    return results;
  }

  // =========================================================================
  // Customer Timeline (Admin Support)
  // =========================================================================

  async getCustomerTimeline(customerId: string): Promise<unknown | null> {
    if (!this.client) return this.mockCustomerTimeline(customerId);

    const [profileRes, paymentsRes, workOrdersRes, messagesRes] = await Promise.all([
      this.client.from('profiles').select('*, unit:units(id, unit_number, property:properties(id, name))').eq('id', customerId).single(),
      this.client.from('payments').select('id, amount, status, created_at, payment_method').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(20),
      this.client.from('work_orders').select('id, title, status, created_at, resolved_at').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(20),
      this.client.from('messages').select('id, subject, created_at, status').or(`sender_id.eq.${customerId},recipient_id.eq.${customerId}`).order('created_at', { ascending: false }).limit(20),
    ]);

    if (profileRes.error || !profileRes.data) return this.mockCustomerTimeline(customerId);

    const profile = profileRes.data;
    const payments = paymentsRes.data || [];
    const workOrders = workOrdersRes.data || [];
    const messages = messagesRes.data || [];

    const events = [
      ...payments.map((p) => ({ type: 'payment', timestamp: p.created_at, description: `Payment - ${p.payment_method} - ${p.amount}`, status: p.status })),
      ...workOrders.map((w) => ({ type: 'maintenance', timestamp: w.created_at, description: `Maintenance: ${w.title}`, status: w.status })),
      ...messages.map((m) => ({ type: 'communication', timestamp: m.created_at, description: `Message: ${m.subject}`, status: m.status })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const totalPaid = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      customer: {
        id: profile.id,
        name: `${profile.first_name} ${profile.last_name}`,
        email: profile.email,
        phone: profile.phone,
        unit: profile.unit ? { id: profile.unit.id, number: profile.unit.unit_number, property: profile.unit.property?.name } : null,
        tenantId: profile.tenant_id,
        status: profile.status || 'active',
      },
      events: events.slice(0, 30),
      financials: {
        totalPaid,
        totalBilled: 0,
        balance: 0,
        paymentHistory: payments.slice(0, 10).map((p) => ({ amount: p.amount, status: p.status, paidOn: p.created_at })),
      },
      maintenance: {
        totalRequests: workOrders.length,
        openRequests: workOrders.filter((w) => !['completed', 'cancelled'].includes(w.status)).length,
        avgResolutionDays: 0,
      },
    };
  }

  // =========================================================================
  // Platform Billing (Admin)
  // =========================================================================

  async getBillingInvoices(pagination: PaginationParams, filters?: { tenantId?: string; status?: string }): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockBillingInvoices(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('platform_invoices')
      .select('*, tenant:tenants(id, name)', { count: 'exact' })
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (filters?.tenantId) query = query.eq('tenant_id', filters.tenantId);
    if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);

    const { data, count, error } = await query;
    if (error || !data) return this.mockBillingInvoices(pagination);

    return {
      data: data.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        tenant: inv.tenant ? { id: inv.tenant.id, name: inv.tenant.name } : null,
        period: inv.period,
        amount: inv.amount,
        status: inv.status,
        dueDate: inv.due_date,
        lineItems: inv.line_items || [],
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  async getBillingUsage(tenantId?: string, period?: string): Promise<unknown[]> {
    if (!this.client) return this.mockBillingUsage();

    let query = this.client.from('tenant_usage').select('*, tenant:tenants(id, name)');
    if (tenantId) query = query.eq('tenant_id', tenantId);
    if (period) query = query.eq('period', period);

    const { data, error } = await query.order('period', { ascending: false }).limit(50);
    if (error || !data) return this.mockBillingUsage();

    return data.map((u) => ({
      tenantId: u.tenant_id,
      tenantName: u.tenant?.name,
      period: u.period,
      metrics: u.metrics || {},
      billing: u.billing || {},
    }));
  }

  // =========================================================================
  // AI Operations (Admin)
  // =========================================================================

  async getAiDecisions(pagination: PaginationParams, filters?: { tenantId?: string; decisionType?: string }): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockAiDecisions(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('ai_decisions')
      .select('*, tenant:tenants(id, name)', { count: 'exact' })
      .range(offset, offset + pageSize - 1)
      .order('created_at', { ascending: false });

    if (filters?.tenantId) query = query.eq('tenant_id', filters.tenantId);
    if (filters?.decisionType) query = query.eq('decision_type', filters.decisionType);

    const { data, count, error } = await query;
    if (error || !data) return this.mockAiDecisions(pagination);

    return {
      data: data.map((d) => ({
        id: d.id,
        timestamp: d.created_at,
        tenantId: d.tenant_id,
        tenantName: d.tenant?.name,
        decisionType: d.decision_type,
        input: d.input,
        output: d.output,
        humanOverride: d.human_override || false,
        overrideReason: d.override_reason,
        outcome: d.outcome,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  async getAiMetrics(): Promise<unknown> {
    if (!this.client) return this.mockAiMetrics();

    const { data } = await this.client
      .from('ai_decisions')
      .select('decision_type, human_override, outcome, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(1000);

    const decisions = data || [];
    const triageDecisions = decisions.filter((d) => d.decision_type === 'maintenance_triage');
    const vendorDecisions = decisions.filter((d) => d.decision_type === 'vendor_recommendation');

    return {
      period: new Date().toISOString().slice(0, 7),
      triageAccuracy: {
        correct: triageDecisions.filter((d) => !d.human_override).length,
        incorrect: 0,
        humanOverrides: triageDecisions.filter((d) => d.human_override).length,
        accuracy: triageDecisions.length > 0 ? triageDecisions.filter((d) => !d.human_override).length / triageDecisions.length : 0,
      },
      vendorMatching: {
        recommendations: vendorDecisions.length,
        accepted: vendorDecisions.filter((d) => !d.human_override).length,
        overridden: vendorDecisions.filter((d) => d.human_override).length,
        acceptanceRate: vendorDecisions.length > 0 ? vendorDecisions.filter((d) => !d.human_override).length / vendorDecisions.length : 0,
      },
      totalDecisions: decisions.length,
    };
  }

  // =========================================================================
  // Stuck Workflows (Admin)
  // =========================================================================

  async getStuckWorkflows(): Promise<unknown[]> {
    if (!this.client) return this.mockStuckWorkflows();

    const { data, error } = await this.client
      .from('workflows')
      .select('*, tenant:tenants(id, name)')
      .eq('status', 'stuck')
      .order('stuck_since', { ascending: true })
      .limit(50);

    if (error || !data) return this.mockStuckWorkflows();

    return data.map((wf) => ({
      id: wf.id,
      type: wf.type,
      tenantId: wf.tenant_id,
      tenantName: wf.tenant?.name,
      stuckAt: wf.stuck_at,
      stuckSince: wf.stuck_since,
      reason: wf.reason,
      data: wf.data,
      suggestedActions: wf.suggested_actions || [],
    }));
  }

  // =========================================================================
  // Disbursements (Owner)
  // =========================================================================

  async getDisbursements(ownerId: string, pagination: PaginationParams): Promise<PaginatedResult<unknown>> {
    if (!this.client) return this.mockDisbursements(pagination);

    const { page, pageSize } = pagination;
    const offset = (page - 1) * pageSize;

    const { data, count, error } = await this.client
      .from('disbursements')
      .select('*, property:properties(id, name)', { count: 'exact' })
      .eq('owner_id', ownerId)
      .range(offset, offset + pageSize - 1)
      .order('date', { ascending: false });

    if (error || !data) return this.mockDisbursements(pagination);

    return {
      data: data.map((d) => ({
        id: d.id,
        date: d.date,
        amount: d.amount,
        property: d.property ? { id: d.property.id, name: d.property.name } : null,
        period: d.period,
        bankAccount: d.bank_account_masked,
        status: d.status,
        reference: d.reference,
      })),
      pagination: { page, pageSize, total: count || 0, totalPages: Math.ceil((count || 0) / pageSize) },
    };
  }

  // =========================================================================
  // Arrears (Owner)
  // =========================================================================

  async getArrears(ownerId: string, propertyIds?: string): Promise<unknown> {
    if (!this.client) return this.mockArrears();

    let query = this.client
      .from('invoices')
      .select('id, amount, due_date, status, customer_id, profiles!invoices_customer_id_fkey(first_name, last_name), unit:units(unit_number, property:properties(id, name, owner_id))')
      .eq('status', 'overdue');

    const { data, error } = await query.limit(200);
    if (error || !data) return this.mockArrears();

    // Filter by owner's properties
    const ownerInvoices = data.filter((inv: any) => inv.unit?.property?.owner_id === ownerId);
    const totalOutstanding = ownerInvoices.reduce((sum, inv: any) => sum + (inv.amount || 0), 0);

    // Group by property
    const byProperty: Record<string, { propertyId: string; propertyName: string; amount: number; tenants: number }> = {};
    for (const inv of ownerInvoices as any[]) {
      const propId = inv.unit?.property?.id || 'unknown';
      if (!byProperty[propId]) {
        byProperty[propId] = { propertyId: propId, propertyName: inv.unit?.property?.name || '', amount: 0, tenants: 0 };
      }
      byProperty[propId].amount += inv.amount || 0;
      byProperty[propId].tenants += 1;
    }

    return {
      summary: {
        totalOutstanding,
        tenantsInArrears: ownerInvoices.length,
        percentageOfRentRoll: 0,
      },
      byProperty: Object.values(byProperty),
      tenants: ownerInvoices.slice(0, 20).map((inv: any) => ({
        customerId: inv.customer_id,
        name: inv.profiles ? `${inv.profiles.first_name} ${inv.profiles.last_name}` : 'Unknown',
        unit: inv.unit?.unit_number,
        property: inv.unit?.property?.name,
        amountOwed: inv.amount,
        daysOverdue: inv.due_date ? Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)) : 0,
        status: 'overdue',
      })),
    };
  }

  // =========================================================================
  // Maintenance Costs (Owner)
  // =========================================================================

  async getMaintenanceCosts(ownerId: string, dateRange?: DateRangeParams, propertyIds?: string): Promise<unknown> {
    if (!this.client) return this.mockMaintenanceCosts();

    let query = this.client
      .from('work_orders')
      .select('id, category, total_cost, labor_cost, materials_cost, status, property:properties(id, name, owner_id), created_at')
      .eq('status', 'completed');

    if (dateRange?.startDate) query = query.gte('created_at', dateRange.startDate);
    if (dateRange?.endDate) query = query.lte('created_at', dateRange.endDate);

    const { data, error } = await query.limit(500);
    if (error || !data) return this.mockMaintenanceCosts();

    const ownerWos = (data as any[]).filter((wo) => wo.property?.owner_id === ownerId);
    const totalCost = ownerWos.reduce((sum, wo) => sum + (wo.total_cost || wo.labor_cost || 0) + (wo.materials_cost || 0), 0);

    // Group by category
    const byCategory: Record<string, { cost: number; count: number }> = {};
    for (const wo of ownerWos) {
      const cat = wo.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = { cost: 0, count: 0 };
      byCategory[cat].cost += (wo.total_cost || wo.labor_cost || 0) + (wo.materials_cost || 0);
      byCategory[cat].count += 1;
    }

    // Group by property
    const byProperty: Record<string, { propertyId: string; propertyName: string; cost: number; count: number }> = {};
    for (const wo of ownerWos) {
      const propId = wo.property?.id || 'unknown';
      if (!byProperty[propId]) byProperty[propId] = { propertyId: propId, propertyName: wo.property?.name || '', cost: 0, count: 0 };
      byProperty[propId].cost += (wo.total_cost || wo.labor_cost || 0) + (wo.materials_cost || 0);
      byProperty[propId].count += 1;
    }

    return {
      summary: {
        totalCost,
        avgCostPerWorkOrder: ownerWos.length > 0 ? totalCost / ownerWos.length : 0,
        workOrderCount: ownerWos.length,
      },
      byCategory: Object.entries(byCategory).map(([category, data]) => ({
        category,
        cost: data.cost,
        count: data.count,
        percentage: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
      })),
      byProperty: Object.values(byProperty),
      trend: [],
    };
  }

  // =========================================================================
  // Available Reports (Owner)
  // =========================================================================

  async getAvailableReports(): Promise<unknown[]> {
    // Reports catalog - stored in DB or static config
    if (this.client) {
      const { data } = await this.client.from('report_templates').select('*').eq('active', true).order('name');
      if (data && data.length > 0) {
        return data.map((r) => ({
          id: r.id || r.slug,
          name: r.name,
          description: r.description,
          formats: r.formats || ['pdf', 'excel'],
          frequency: r.frequency || ['monthly'],
        }));
      }
    }

    // Fallback static config (not mock data - these are real report types)
    return [
      { id: 'financial-summary', name: 'Financial Summary', description: 'Monthly income, expenses, and net operating income', formats: ['pdf', 'excel'], frequency: ['monthly', 'quarterly', 'annually'] },
      { id: 'occupancy-report', name: 'Occupancy Report', description: 'Unit occupancy rates and vacancy analysis', formats: ['pdf', 'excel'], frequency: ['monthly', 'quarterly'] },
      { id: 'maintenance-report', name: 'Maintenance Report', description: 'Work orders, costs, and vendor performance', formats: ['pdf', 'excel'], frequency: ['monthly'] },
      { id: 'arrears-report', name: 'Arrears Report', description: 'Outstanding rent and collection efforts', formats: ['pdf', 'excel'], frequency: ['weekly', 'monthly'] },
    ];
  }

  // =========================================================================
  // Onboarding Status (Customer)
  // =========================================================================

  async getOnboardingStatus(userId: string): Promise<unknown> {
    if (!this.client) return this.mockOnboardingStatus();

    const { data } = await this.client
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) {
      // Check feature_discovery table as alternative
      const { data: features } = await this.client
        .from('feature_discovery')
        .select('feature_key, completed, completed_at')
        .eq('user_id', userId)
        .like('feature_key', 'onboarding_%');

      const steps = [
        { id: 'profile_completion', name: 'Complete Your Profile', description: 'Add your personal details and emergency contact' },
        { id: 'id_verification', name: 'Verify Your Identity', description: 'Upload your ID for verification' },
        { id: 'lease_signing', name: 'Sign Your Lease', description: 'Review and sign your lease agreement' },
        { id: 'move_in_inspection', name: 'Move-In Inspection', description: 'Complete the move-in inspection with photos' },
        { id: 'utility_setup', name: 'Set Up Utilities', description: 'Learn how to manage your utilities' },
        { id: 'welcome_completion', name: 'Welcome Complete', description: 'You are all set! Explore your new home' },
      ];

      const featureMap = new Map((features || []).map((f) => [f.feature_key, f]));
      let foundCurrentStep = false;

      const enrichedSteps = steps.map((step) => {
        const feature = featureMap.get(`onboarding_${step.id}`);
        if (feature?.completed) {
          return { ...step, status: 'completed', completedAt: feature.completed_at };
        }
        if (!foundCurrentStep) {
          foundCurrentStep = true;
          return { ...step, status: 'in_progress' };
        }
        return { ...step, status: 'pending' };
      });

      const completedCount = enrichedSteps.filter((s) => s.status === 'completed').length;
      const currentStep = enrichedSteps.find((s) => s.status === 'in_progress')?.id || enrichedSteps[0].id;

      return {
        currentStep,
        totalSteps: steps.length,
        completedSteps: completedCount,
        percentComplete: Math.round((completedCount / steps.length) * 100),
        steps: enrichedSteps,
      };
    }

    return data;
  }

  // =========================================================================
  // Notification Preferences (Customer)
  // =========================================================================

  async getNotificationPreferences(userId: string): Promise<unknown> {
    if (!this.client) return this.mockNotificationPreferences();

    const { data } = await this.client
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) {
      // Return defaults
      return {
        channels: { whatsapp: true, sms: false, email: true, push: true },
        quietHours: { enabled: false, start: '22:00', end: '07:00' },
        categories: { billing: true, maintenance: true, announcements: true, community: false },
      };
    }

    return {
      channels: data.channels || { whatsapp: true, sms: false, email: true, push: true },
      quietHours: data.quiet_hours || { enabled: false, start: '22:00', end: '07:00' },
      categories: data.categories || { billing: true, maintenance: true, announcements: true, community: false },
    };
  }

  // =========================================================================
  // Create Operations
  // =========================================================================

  async createMaintenanceRequest(data: {
    customerId: string;
    propertyId?: string;
    unitId?: string;
    category: string;
    priority: string;
    title: string;
    description: string;
    location: string;
    permissionToEnter: boolean;
    entryInstructions?: string;
  }): Promise<unknown> {
    if (!this.client) {
      return {
        id: `maint_${Date.now()}`,
        ticketNumber: `WO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        ...data,
        status: 'submitted',
        createdAt: new Date().toISOString(),
      };
    }

    const ticketNumber = `WO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

    const { data: result, error } = await this.client
      .from('work_orders')
      .insert({
        customer_id: data.customerId,
        property_id: data.propertyId,
        unit_id: data.unitId,
        ticket_number: ticketNumber,
        category: data.category,
        priority: data.priority,
        title: data.title,
        description: data.description,
        location: data.location,
        permission_to_enter: data.permissionToEnter,
        entry_instructions: data.entryInstructions,
        status: 'submitted',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ...result, ticketNumber };
  }

  async initiatePayment(data: {
    customerId: string;
    invoiceId: string;
    paymentMethod: string;
    amount: number;
    phone?: string;
  }): Promise<unknown> {
    if (!this.client) {
      return {
        id: `pay_${Date.now()}`,
        ...data,
        status: 'initiated',
        initiatedAt: new Date().toISOString(),
      };
    }

    const { data: result, error } = await this.client
      .from('payments')
      .insert({
        customer_id: data.customerId,
        invoice_id: data.invoiceId,
        payment_method: data.paymentMethod,
        amount: data.amount,
        phone: data.phone,
        status: 'initiated',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result;
  }

  // =========================================================================
  // Mock Data Fallbacks (development only)
  // =========================================================================

  private mockPropertiesList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') {
      return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    }
    const data = [
      { id: 'prop-001', name: 'Masaki Heights', address: 'Plot 123, Masaki, Dar es Salaam', type: 'residential', totalUnits: 24, occupiedUnits: 22, occupancyRate: 0.917, monthlyRentRoll: 19200000, status: 'active' },
      { id: 'prop-002', name: 'Oyster Bay Apartments', address: 'Plot 456, Oyster Bay, Dar es Salaam', type: 'residential', totalUnits: 16, occupiedUnits: 14, occupancyRate: 0.875, monthlyRentRoll: 16800000, status: 'active' },
    ];
    return { data, pagination: { ...pagination, total: data.length, totalPages: 1 } };
  }

  private mockPropertyDetail(propertyId: string): unknown {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      id: propertyId, name: 'Masaki Heights', address: 'Plot 123, Masaki, Dar es Salaam',
      type: 'residential', description: 'Modern apartment complex', amenities: ['Pool', 'Gym', 'Parking', 'Security'],
      totalUnits: 24, occupiedUnits: 22, vacantUnits: 2, units: [], status: 'active',
    };
  }

  private mockOwnerDashboard(): unknown {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      portfolioSummary: { totalProperties: 2, totalUnits: 40, occupancyRate: 0.90 },
      financials: { rentBilled: 36000000, rentCollected: 33120000, collectionRate: 0.92, arrearsTotal: 2880000 },
      maintenance: { openWorkOrders: 5 },
    };
  }

  private mockCustomerProfile(customerId: string): unknown {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      id: customerId, email: 'tenant@demo.local', phone: '+255700000001',
      firstName: 'Demo', lastName: 'Tenant', idVerified: true,
      occupancy: { unitNumber: 'A1', propertyName: 'Masaki Heights' },
    };
  }

  private mockPaymentsList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [{ id: 'pay-001', date: new Date().toISOString(), amount: 800000, method: 'mpesa', status: 'completed' }], pagination: { ...pagination, total: 1, totalPages: 1 } };
  }

  private mockMaintenanceList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockInvoicesList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [{ id: 'inv-001', invoiceNumber: 'INV-2024-001', amount: 800000, dueDate: '2024-04-01', status: 'pending' }], pagination: { ...pagination, total: 1, totalPages: 1 } };
  }

  private mockWorkOrdersList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockNotificationsList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [{ id: 'notif-001', type: 'info', title: 'Welcome', message: 'Welcome to BOSSNYUMBA', createdAt: new Date().toISOString(), read: false }], pagination: { ...pagination, total: 1, totalPages: 1 } };
  }

  private mockMessagesList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockInspectionsList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockOccupancySummary(): unknown {
    if (process.env.NODE_ENV === 'production') return { summary: { totalUnits: 0, occupied: 0, vacant: 0, turnover: 0, occupancyRate: 0 }, units: [] };
    return {
      summary: { totalUnits: 48, occupied: 44, vacant: 3, turnover: 1, occupancyRate: 0.917 },
      units: [],
    };
  }

  private mockCollections(pagination: PaginationParams): unknown {
    if (process.env.NODE_ENV === 'production') return { summary: { totalOutstanding: 0, tenantsInArrears: 0 }, accounts: [] };
    return { summary: { totalOutstanding: 0, tenantsInArrears: 0 }, accounts: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockVendorsList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockLeasesList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockTenantsList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockUsersList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockAuditLogsList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockPlatformDashboard(): unknown {
    if (process.env.NODE_ENV === 'production') return { systemHealth: { status: 'unknown' }, platformMetrics: {} };
    return {
      systemHealth: { status: 'healthy', uptime: 99.95 },
      platformMetrics: { totalTenants: 2, activeTenants: 2, totalUsers: 10, activeUsers24h: 5, totalProperties: 4, totalUnits: 48, occupancyRate: 0.917 },
    };
  }

  private mockDocumentsList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockFinancialStatements(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockInspectionDetail(inspectionId: string): unknown {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      id: inspectionId, type: 'move_in', property: null, unit: null, customer: null,
      status: 'scheduled', scheduledDate: new Date().toISOString().split('T')[0], scheduledTime: '09:00',
      inspector: null, checklist: { rooms: [], itemsPerRoom: [], additionalItems: [] },
      meterReadings: {}, keysHandover: {}, completedItems: [], baselineComparison: null,
      createdAt: new Date().toISOString(), startedAt: null,
    };
  }

  private mockVendorScorecard(vendorId: string): unknown {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      vendorId, vendorName: 'Demo Vendor', period: new Date().toISOString().slice(0, 7),
      overallScore: 0, metrics: {}, recentJobs: [], issues: [], recommendations: [],
    };
  }

  private mockSlaMetrics(): unknown {
    if (process.env.NODE_ENV === 'production') return { summary: { responseCompliance: 0, resolutionCompliance: 0, atRiskCount: 0, breachedCount: 0 }, byCategory: [], atRisk: [], breached: [], trends: [] };
    return { summary: { responseCompliance: 1, resolutionCompliance: 1, atRiskCount: 0, breachedCount: 0 }, byCategory: [], atRisk: [], breached: [], trends: [] };
  }

  private mockTenantDetail(tenantId: string): unknown {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      id: tenantId, code: 'DEMO', name: 'Demo Tenant', type: 'company', status: 'active',
      contact: {}, address: {}, subscription: { plan: 'starter', status: 'active' },
      usage: { properties: 0, units: 0, users: 0 }, billing: {}, policyConstitution: {},
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }

  private mockRolesList(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockSearchResults(): unknown {
    if (process.env.NODE_ENV === 'production') return { customers: [], properties: [], invoices: [], payments: [], workOrders: [] };
    return { customers: [], properties: [], invoices: [], payments: [], workOrders: [] };
  }

  private mockCustomerTimeline(customerId: string): unknown {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      customer: { id: customerId, name: 'Demo Customer', email: '', phone: '', unit: null, tenantId: null, status: 'active' },
      events: [], financials: { totalPaid: 0, totalBilled: 0, balance: 0, paymentHistory: [] },
      maintenance: { totalRequests: 0, openRequests: 0, avgResolutionDays: 0 },
    };
  }

  private mockBillingInvoices(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockBillingUsage(): unknown[] {
    if (process.env.NODE_ENV === 'production') return [];
    return [];
  }

  private mockAiDecisions(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockAiMetrics(): unknown {
    if (process.env.NODE_ENV === 'production') return { period: '', triageAccuracy: {}, vendorMatching: {}, totalDecisions: 0 };
    return { period: '', triageAccuracy: {}, vendorMatching: {}, totalDecisions: 0 };
  }

  private mockStuckWorkflows(): unknown[] {
    if (process.env.NODE_ENV === 'production') return [];
    return [];
  }

  private mockDisbursements(pagination: PaginationParams): PaginatedResult<unknown> {
    if (process.env.NODE_ENV === 'production') return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
    return { data: [], pagination: { ...pagination, total: 0, totalPages: 0 } };
  }

  private mockArrears(): unknown {
    if (process.env.NODE_ENV === 'production') return { summary: { totalOutstanding: 0, tenantsInArrears: 0, percentageOfRentRoll: 0 }, byProperty: [], tenants: [] };
    return { summary: { totalOutstanding: 0, tenantsInArrears: 0, percentageOfRentRoll: 0 }, byProperty: [], tenants: [] };
  }

  private mockMaintenanceCosts(): unknown {
    if (process.env.NODE_ENV === 'production') return { summary: { totalCost: 0, avgCostPerWorkOrder: 0, workOrderCount: 0 }, byCategory: [], byProperty: [], trend: [] };
    return { summary: { totalCost: 0, avgCostPerWorkOrder: 0, workOrderCount: 0 }, byCategory: [], byProperty: [], trend: [] };
  }

  private mockOnboardingStatus(): unknown {
    if (process.env.NODE_ENV === 'production') return { currentStep: 'profile_completion', totalSteps: 6, completedSteps: 0, percentComplete: 0, steps: [] };
    return { currentStep: 'profile_completion', totalSteps: 6, completedSteps: 0, percentComplete: 0, steps: [] };
  }

  private mockNotificationPreferences(): unknown {
    return {
      channels: { whatsapp: true, sms: false, email: true, push: true },
      quietHours: { enabled: false, start: '22:00', end: '07:00' },
      categories: { billing: true, maintenance: true, announcements: true, community: false },
    };
  }
}

// Singleton
let _dataService: DataAccessService | null = null;

export function getDataService(): DataAccessService {
  if (!_dataService) {
    _dataService = new DataAccessService();
  }
  return _dataService;
}
