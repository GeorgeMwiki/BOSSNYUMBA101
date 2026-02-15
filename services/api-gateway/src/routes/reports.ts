import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  DEMO_INVOICES,
  DEMO_PAYMENTS,
  DEMO_WORK_ORDERS,
  DEMO_UNITS,
  DEMO_PROPERTIES,
  DEMO_LEASES,
  getByTenant,
} from '../data/mock-data';

export const reportsRouter = Router();

// GET /reports/financial - Financial summary report
reportsRouter.get('/financial', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { startDate, endDate } = req.query;

  const invoices = getByTenant(DEMO_INVOICES, auth.tenantId);
  const payments = getByTenant(DEMO_PAYMENTS, auth.tenantId);

  // Calculate totals
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total, 0);
  const totalCollected = payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + i.amountDue, 0);

  // Group by month
  const monthlyData: Record<string, { invoiced: number; collected: number }> = {};
  invoices.forEach((i) => {
    const month = new Date(i.createdAt).toISOString().slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = { invoiced: 0, collected: 0 };
    }
    monthlyData[month].invoiced += i.total;
  });
  payments.filter((p) => p.status === 'COMPLETED').forEach((p) => {
    const month = new Date(p.createdAt).toISOString().slice(0, 7);
    if (!monthlyData[month]) {
      monthlyData[month] = { invoiced: 0, collected: 0 };
    }
    monthlyData[month].collected += p.amount;
  });

  res.json({
    success: true,
    data: {
      summary: {
        totalInvoiced,
        totalCollected,
        totalOutstanding,
        collectionRate: totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0,
      },
      monthlyTrend: Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data,
      })),
      arrearsAging: {
        current: invoices.filter((i) => i.status === 'SENT').reduce((sum, i) => sum + i.amountDue, 0),
        overdue: invoices.filter((i) => i.status === 'OVERDUE').reduce((sum, i) => sum + i.amountDue, 0),
      },
    },
  });
});

// GET /reports/occupancy - Occupancy report
reportsRouter.get('/occupancy', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;

  const units = getByTenant(DEMO_UNITS, auth.tenantId);
  const properties = getByTenant(DEMO_PROPERTIES, auth.tenantId);
  const leases = getByTenant(DEMO_LEASES, auth.tenantId);

  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => u.status === 'OCCUPIED').length;
  const availableUnits = units.filter((u) => u.status === 'AVAILABLE').length;
  const maintenanceUnits = units.filter((u) => u.status === 'MAINTENANCE').length;

  // By property
  const byProperty = properties.map((p) => {
    const propertyUnits = units.filter((u) => u.propertyId === p.id);
    const occupied = propertyUnits.filter((u) => u.status === 'OCCUPIED').length;
    return {
      id: p.id,
      name: p.name,
      totalUnits: propertyUnits.length,
      occupiedUnits: occupied,
      occupancyRate: propertyUnits.length > 0 ? (occupied / propertyUnits.length) * 100 : 0,
    };
  });

  // Expiring leases
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const expiring30Days = leases.filter((l) => {
    const endDate = new Date(l.endDate);
    return l.status === 'ACTIVE' && endDate >= now && endDate <= thirtyDaysFromNow;
  }).length;

  const expiring60Days = leases.filter((l) => {
    const endDate = new Date(l.endDate);
    return l.status === 'ACTIVE' && endDate >= now && endDate <= sixtyDaysFromNow;
  }).length;

  res.json({
    success: true,
    data: {
      summary: {
        totalUnits,
        occupiedUnits,
        availableUnits,
        maintenanceUnits,
        occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
      },
      byProperty,
      leaseExpiry: {
        next30Days: expiring30Days,
        next60Days: expiring60Days,
      },
    },
  });
});

// GET /reports/maintenance - Maintenance report
reportsRouter.get('/maintenance', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;

  const workOrders = getByTenant(DEMO_WORK_ORDERS, auth.tenantId);

  const total = workOrders.length;
  const completed = workOrders.filter((wo) => wo.status === 'COMPLETED').length;
  const open = workOrders.filter((wo) => !['COMPLETED', 'CANCELLED'].includes(wo.status)).length;

  // Calculate average resolution time for completed orders
  const completedWithTime = workOrders.filter(
    (wo) => wo.status === 'COMPLETED' && wo.completedAt
  );
  const avgResolutionTime = completedWithTime.length > 0
    ? completedWithTime.reduce((sum, wo) => {
        const reported = new Date(wo.reportedAt).getTime();
        const completed = new Date(wo.completedAt!).getTime();
        return sum + (completed - reported);
      }, 0) / completedWithTime.length / (1000 * 60 * 60) // Convert to hours
    : 0;

  // By category
  const categories = ['PLUMBING', 'ELECTRICAL', 'HVAC', 'STRUCTURAL', 'OTHER'];
  const byCategory = categories.map((cat) => ({
    category: cat,
    count: workOrders.filter((wo) => wo.category === cat || (cat === 'OTHER' && !categories.slice(0, -1).includes(wo.category))).length,
  }));

  // By priority
  const byPriority = {
    emergency: workOrders.filter((wo) => wo.priority === 'EMERGENCY').length,
    high: workOrders.filter((wo) => wo.priority === 'HIGH').length,
    medium: workOrders.filter((wo) => wo.priority === 'MEDIUM').length,
    low: workOrders.filter((wo) => wo.priority === 'LOW').length,
  };

  // Total cost
  const totalCost = workOrders
    .filter((wo) => wo.actualCost)
    .reduce((sum, wo) => sum + (wo.actualCost || 0), 0);

  res.json({
    success: true,
    data: {
      summary: {
        total,
        completed,
        open,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
        avgResolutionTimeHours: Math.round(avgResolutionTime),
        totalCost,
      },
      byCategory,
      byPriority,
    },
  });
});

// GET /reports/statements - Generate owner statement
reportsRouter.get('/statements', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { period = 'current_month' } = req.query;

  const invoices = getByTenant(DEMO_INVOICES, auth.tenantId);
  const payments = getByTenant(DEMO_PAYMENTS, auth.tenantId);
  const workOrders = getByTenant(DEMO_WORK_ORDERS, auth.tenantId);

  // Current month filter
  const currentMonth = new Date().getMonth();
  const currentMonthInvoices = invoices.filter(
    (i) => new Date(i.createdAt).getMonth() === currentMonth
  );
  const currentMonthPayments = payments.filter(
    (p) => new Date(p.createdAt).getMonth() === currentMonth && p.status === 'COMPLETED'
  );
  const currentMonthWorkOrders = workOrders.filter(
    (wo) => wo.completedAt && new Date(wo.completedAt).getMonth() === currentMonth
  );

  const totalRentBilled = currentMonthInvoices
    .filter((i) => i.type === 'RENT')
    .reduce((sum, i) => sum + i.total, 0);
  const totalCollected = currentMonthPayments.reduce((sum, p) => sum + p.amount, 0);
  const maintenanceCosts = currentMonthWorkOrders.reduce((sum, wo) => sum + (wo.actualCost || 0), 0);

  res.json({
    success: true,
    data: {
      period: {
        start: new Date(new Date().getFullYear(), currentMonth, 1).toISOString(),
        end: new Date(new Date().getFullYear(), currentMonth + 1, 0).toISOString(),
      },
      income: {
        rentBilled: totalRentBilled,
        collected: totalCollected,
        outstanding: totalRentBilled - totalCollected,
      },
      expenses: {
        maintenance: maintenanceCosts,
        total: maintenanceCosts,
      },
      netOperatingIncome: totalCollected - maintenanceCosts,
      entries: [
        ...currentMonthInvoices.map((i) => ({
          date: i.createdAt,
          type: 'income',
          description: `Invoice ${i.number}`,
          amount: i.total,
        })),
        ...currentMonthPayments.map((p) => ({
          date: p.createdAt,
          type: 'income',
          description: `Payment ${p.reference}`,
          amount: p.amount,
        })),
        ...currentMonthWorkOrders.filter((wo) => wo.actualCost).map((wo) => ({
          date: wo.completedAt,
          type: 'expense',
          description: `Maintenance: ${wo.title}`,
          amount: -(wo.actualCost || 0),
        })),
      ].sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()),
    },
  });
});

// GET /reports/export/:type - Export report as CSV/PDF
reportsRouter.get('/export/:type', (req, res: Response) => {
  const { type } = req.params;
  const { format = 'csv' } = req.query;

  // In a real implementation, this would generate the actual file
  res.json({
    success: true,
    data: {
      message: `Report ${type} export in ${format} format`,
      downloadUrl: `/api/v1/reports/download/${type}.${format}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    },
  });
});
