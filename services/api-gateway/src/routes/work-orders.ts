import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { DEMO_WORK_ORDERS, DEMO_UNITS, DEMO_CUSTOMERS, DEMO_PROPERTIES, getByTenant, getById, paginate } from '../data/mock-data';

export const workOrdersRouter = Router();

// GET /work-orders - List work orders
workOrdersRouter.get('/', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { page = '1', pageSize = '10', status, priority, category, propertyId } = req.query;

  let workOrders = getByTenant(DEMO_WORK_ORDERS, auth.tenantId);

  // Filter by property access
  if (!auth.propertyAccess.includes('*')) {
    workOrders = workOrders.filter((wo) => auth.propertyAccess.includes(wo.propertyId));
  }

  // Filter by status
  if (status) {
    workOrders = workOrders.filter((wo) => wo.status === status);
  }

  // Filter by priority
  if (priority) {
    workOrders = workOrders.filter((wo) => wo.priority === priority);
  }

  // Filter by category
  if (category) {
    workOrders = workOrders.filter((wo) => wo.category === category);
  }

  // Filter by propertyId
  if (propertyId) {
    workOrders = workOrders.filter((wo) => wo.propertyId === propertyId);
  }

  // Sort by creation date (newest first)
  workOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const result = paginate(workOrders, Number(page), Number(pageSize));

  // Enrich with unit and customer info
  const enrichedData = result.data.map((wo) => {
    const unit = getById(DEMO_UNITS, wo.unitId);
    const customer = getById(DEMO_CUSTOMERS, wo.customerId);
    const property = getById(DEMO_PROPERTIES, wo.propertyId);

    return {
      ...wo,
      unit: unit ? { id: unit.id, unitNumber: unit.unitNumber } : null,
      property: property ? { id: property.id, name: property.name } : null,
      customer: customer ? { id: customer.id, name: `${customer.firstName} ${customer.lastName}` } : null,
    };
  });

  res.json({
    success: true,
    data: enrichedData,
    pagination: result.pagination,
  });
});

// GET /work-orders/:id - Get work order by ID
workOrdersRouter.get('/:id', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;
  const { id } = req.params;

  const workOrder = getById(DEMO_WORK_ORDERS, id);

  if (!workOrder || workOrder.tenantId !== auth.tenantId) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Work order not found' },
    });
  }

  const unit = getById(DEMO_UNITS, workOrder.unitId);
  const customer = getById(DEMO_CUSTOMERS, workOrder.customerId);
  const property = getById(DEMO_PROPERTIES, workOrder.propertyId);

  res.json({
    success: true,
    data: {
      ...workOrder,
      unit,
      customer,
      property,
    },
  });
});

// GET /work-orders/stats - Get work order statistics
workOrdersRouter.get('/stats/summary', (req, res: Response) => {
  const auth = (req as AuthenticatedRequest).auth;

  let workOrders = getByTenant(DEMO_WORK_ORDERS, auth.tenantId);

  // Filter by property access
  if (!auth.propertyAccess.includes('*')) {
    workOrders = workOrders.filter((wo) => auth.propertyAccess.includes(wo.propertyId));
  }

  const stats = {
    total: workOrders.length,
    byStatus: {
      submitted: workOrders.filter((wo) => wo.status === 'SUBMITTED').length,
      triaged: workOrders.filter((wo) => wo.status === 'TRIAGED').length,
      approved: workOrders.filter((wo) => wo.status === 'APPROVED').length,
      assigned: workOrders.filter((wo) => wo.status === 'ASSIGNED').length,
      inProgress: workOrders.filter((wo) => wo.status === 'IN_PROGRESS').length,
      completed: workOrders.filter((wo) => wo.status === 'COMPLETED').length,
      cancelled: workOrders.filter((wo) => wo.status === 'CANCELLED').length,
    },
    byPriority: {
      low: workOrders.filter((wo) => wo.priority === 'LOW').length,
      medium: workOrders.filter((wo) => wo.priority === 'MEDIUM').length,
      high: workOrders.filter((wo) => wo.priority === 'HIGH').length,
      emergency: workOrders.filter((wo) => wo.priority === 'EMERGENCY').length,
    },
    byCategory: {
      plumbing: workOrders.filter((wo) => wo.category === 'PLUMBING').length,
      electrical: workOrders.filter((wo) => wo.category === 'ELECTRICAL').length,
      hvac: workOrders.filter((wo) => wo.category === 'HVAC').length,
      structural: workOrders.filter((wo) => wo.category === 'STRUCTURAL').length,
      other: workOrders.filter((wo) => !['PLUMBING', 'ELECTRICAL', 'HVAC', 'STRUCTURAL'].includes(wo.category)).length,
    },
  };

  res.json({
    success: true,
    data: stats,
  });
});
