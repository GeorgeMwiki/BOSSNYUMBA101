import { createProtectedLiveDataRouter } from '../live-data-router';

export const maintenanceRequestsRouter = createProtectedLiveDataRouter(
  'Maintenance requests module'
);
