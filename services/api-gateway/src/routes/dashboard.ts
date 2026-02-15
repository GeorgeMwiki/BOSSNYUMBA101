import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserRole } from '../types/user-role';
import {
  DEMO_PROPERTIES,
  DEMO_UNITS,
  DEMO_INVOICES,
  DEMO_WORK_ORDERS,
  DEMO_LEASES,
  DEMO_APPROVALS,
  DEMO_CUSTOMERS,
  DEMO_USERS,
  DEMO_TENANT,
  getByTenant,
} from '../data/mock-data';

export const dashboardRouter = Router();

// GET /dashboard/owner - Owner portal dashboard
dashboardRouter.get('/owner', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const tenantId = auth.tenantId;

  const properties = getByTenant(DEMO_PROPERTIES, tenantId);
  const units = getByTenant(DEMO_UNITS, tenantId);
  const invoices = getByTenant(DEMO_INVOICES, tenantId);
  const workOrders = getByTenant(DEMO_WORK_ORDERS, tenantId);
  const leases = getByTenant(DEMO_LEASES, tenantId);
  const approvals = getByTenant(DEMO_APPROVALS, tenantId);

  // Calculate metrics
  const occupiedUnits = units.filter((u) => u.status === 'OCCUPIED').length;
  const totalUnits = units.length;
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

  const currentMonth = new Date().getMonth();
  const currentMonthInvoices = invoices.filter(
    (i) => new Date(i.createdAt).getMonth() === currentMonth
  );
  const currentMonthRevenue = currentMonthInvoices.reduce((sum, i) => sum + i.amountPaid, 0);
  
  const previousMonthInvoices = invoices.filter(
    (i) => new Date(i.createdAt).getMonth() === currentMonth - 1
  );
  const previousMonthRevenue = previousMonthInvoices.reduce((sum, i) => sum + i.amountPaid, 0);

  const revenueChange = previousMonthRevenue > 0
    ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
    : 0;

  const outstandingBalance = invoices.reduce((sum, i) => sum + i.amountDue, 0);

  const openWorkOrders = workOrders.filter(
    (wo) => !['COMPLETED', 'CANCELLED'].includes(wo.status)
  );
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');

  const expiringLeases = leases.filter((l) => {
    const endDate = new Date(l.endDate);
    const daysUntilExpiry = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 60 && daysUntilExpiry > 0;
  });

  const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE');

  const dashboardData: OwnerDashboardData = {
    portfolio: {
      totalProperties: properties.length,
      totalUnits: totalUnits,
      totalValue: properties.length * 500000000, // Estimated
      monthlyRevenue: currentMonthRevenue,
      yearToDateRevenue: invoices.reduce((sum, i) => sum + i.amountPaid, 0),
    },
    financial: {
      currentMonthRevenue,
      previousMonthRevenue,
      revenueChange,
      outstandingBalance,
      collectionRate: currentMonthInvoices.length > 0
        ? (currentMonthInvoices.filter((i) => i.status === 'PAID').length / currentMonthInvoices.length) * 100
        : 100,
      arrearsBreakdown: {
        current: overdueInvoices.filter((i) => {
          const daysOverdue = Math.ceil((Date.now() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          return daysOverdue <= 0;
        }).reduce((sum, i) => sum + i.amountDue, 0),
        days1to7: overdueInvoices.filter((i) => {
          const daysOverdue = Math.ceil((Date.now() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          return daysOverdue >= 1 && daysOverdue <= 7;
        }).reduce((sum, i) => sum + i.amountDue, 0),
        days8to14: overdueInvoices.filter((i) => {
          const daysOverdue = Math.ceil((Date.now() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          return daysOverdue >= 8 && daysOverdue <= 14;
        }).reduce((sum, i) => sum + i.amountDue, 0),
        days15to30: overdueInvoices.filter((i) => {
          const daysOverdue = Math.ceil((Date.now() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          return daysOverdue >= 15 && daysOverdue <= 30;
        }).reduce((sum, i) => sum + i.amountDue, 0),
        days31to60: overdueInvoices.filter((i) => {
          const daysOverdue = Math.ceil((Date.now() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          return daysOverdue >= 31 && daysOverdue <= 60;
        }).reduce((sum, i) => sum + i.amountDue, 0),
        days60plus: overdueInvoices.filter((i) => {
          const daysOverdue = Math.ceil((Date.now() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          return daysOverdue > 60;
        }).reduce((sum, i) => sum + i.amountDue, 0),
      },
    },
    maintenance: {
      openRequests: openWorkOrders.length,
      inProgress: workOrders.filter((wo) => wo.status === 'IN_PROGRESS').length,
      completedThisMonth: workOrders.filter(
        (wo) => wo.status === 'COMPLETED' && wo.completedAt &&
          new Date(wo.completedAt).getMonth() === currentMonth
      ).length,
      averageResolutionTime: 48, // hours - would calculate from actual data
      pendingApprovals: pendingApprovals.filter((a) => a.entityType === 'work_order').length,
      totalCostThisMonth: workOrders
        .filter((wo) => wo.completedAt && new Date(wo.completedAt).getMonth() === currentMonth)
        .reduce((sum, wo) => sum + (wo.actualCost || 0), 0),
    },
    occupancy: {
      occupancyRate,
      vacantUnits: units.filter((u) => u.status === 'AVAILABLE').length,
      expiringLeases: expiringLeases.length,
      pendingMoveIns: 0, // Would calculate from occupancy records
      pendingMoveOuts: 0,
    },
    recentActivity: [
      {
        id: 'activity-1',
        type: 'payment',
        title: 'Payment Received',
        description: 'TZS 2,500,000 received for Unit A101',
        timestamp: new Date('2026-02-03'),
        entityType: 'payment',
        entityId: 'pay-001',
      },
      {
        id: 'activity-2',
        type: 'work_order',
        title: 'Maintenance Request',
        description: 'New plumbing issue reported for Unit A101',
        timestamp: new Date('2026-02-10'),
        entityType: 'work_order',
        entityId: 'wo-001',
      },
      {
        id: 'activity-3',
        type: 'lease',
        title: 'Lease Signed',
        description: 'New lease signed for Unit A102',
        timestamp: new Date('2024-03-28'),
        entityType: 'lease',
        entityId: 'lease-002',
      },
    ],
    alerts: [
      ...(overdueInvoices.length > 0
        ? [{
            id: 'alert-1',
            type: 'WARNING' as const,
            title: 'Overdue Payments',
            message: `${overdueInvoices.length} invoice(s) are overdue`,
            actionRequired: true,
            actionUrl: '/invoices?status=OVERDUE',
            createdAt: new Date(),
          }]
        : []),
      ...(expiringLeases.length > 0
        ? [{
            id: 'alert-2',
            type: 'INFO' as const,
            title: 'Expiring Leases',
            message: `${expiringLeases.length} lease(s) expiring within 60 days`,
            actionRequired: true,
            actionUrl: '/leases?expiring=true',
            createdAt: new Date(),
          }]
        : []),
      ...(pendingApprovals.length > 0
        ? [{
            id: 'alert-3',
            type: 'ACTION_REQUIRED' as const,
            title: 'Pending Approvals',
            message: `${pendingApprovals.length} item(s) awaiting your approval`,
            actionRequired: true,
            actionUrl: '/approvals',
            createdAt: new Date(),
          }]
        : []),
    ],
  };

  res.json({
    success: true,
    data: dashboardData,
  });
});

// GET /dashboard/admin - Admin portal dashboard
dashboardRouter.get('/admin', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;

  // Check if user is admin
  if (![UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN].includes(auth.role)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied',
      },
    });
  }

  const tenantId = auth.tenantId;
  const customers = getByTenant(DEMO_CUSTOMERS, tenantId);
  const approvals = getByTenant(DEMO_APPROVALS, tenantId);
  const properties = getByTenant(DEMO_PROPERTIES, tenantId);
  const units = getByTenant(DEMO_UNITS, tenantId);

  const dashboardData: AdminDashboardData = {
    system: {
      status: 'HEALTHY',
      uptime: 99.9,
      activeUsers: 12,
      apiLatency: 45,
      errorRate: 0.1,
    },
    tenants: {
      total: 1,
      active: 1,
      trial: 0,
      suspended: 0,
      newThisMonth: 0,
    },
    users: {
      total: DEMO_USERS.length,
      active: DEMO_USERS.filter((u) => u.status === 'ACTIVE').length,
      pendingVerification: DEMO_USERS.filter((u) => u.status === 'PENDING_VERIFICATION').length,
      newThisMonth: 0,
    },
    operations: {
      pendingApprovals: approvals.filter((a) => a.status === 'PENDING').length,
      openCases: 0,
      documentsAwaitingVerification: 0,
      scheduledTasks: 3,
    },
    recentActivity: [
      {
        id: 'admin-activity-1',
        type: 'user',
        title: 'New User Created',
        description: 'Sarah Kimaro added as Property Manager',
        timestamp: new Date('2024-01-15'),
        entityType: 'user',
        entityId: 'user-002',
      },
      {
        id: 'admin-activity-2',
        type: 'property',
        title: 'Property Added',
        description: 'Masaki Heights added to portfolio',
        timestamp: new Date('2024-02-01'),
        entityType: 'property',
        entityId: 'property-002',
      },
      {
        id: 'admin-activity-3',
        type: 'approval',
        title: 'Approval Pending',
        description: 'Work order approval waiting for owner',
        timestamp: new Date('2026-02-11'),
        entityType: 'approval',
        entityId: 'approval-001',
      },
    ],
    alerts: [
      {
        id: 'admin-alert-1',
        type: 'INFO',
        title: 'System Update',
        message: 'Scheduled maintenance window: Feb 15, 2026 2:00 AM - 4:00 AM EAT',
        actionRequired: false,
        createdAt: new Date(),
      },
    ],
  };

  res.json({
    success: true,
    data: dashboardData,
  });
});

// GET /dashboard/stats - Quick stats for headers
dashboardRouter.get('/stats', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const tenantId = auth.tenantId;

  const invoices = getByTenant(DEMO_INVOICES, tenantId);
  const workOrders = getByTenant(DEMO_WORK_ORDERS, tenantId);
  const approvals = getByTenant(DEMO_APPROVALS, tenantId);

  res.json({
    success: true,
    data: {
      notifications: 3,
      pendingApprovals: approvals.filter((a) => a.status === 'PENDING').length,
      overdueInvoices: invoices.filter((i) => i.status === 'OVERDUE').length,
      openWorkOrders: workOrders.filter((wo) => !['COMPLETED', 'CANCELLED'].includes(wo.status)).length,
    },
  });
});
