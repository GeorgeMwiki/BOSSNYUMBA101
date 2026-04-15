/**
 * Re-export the live maintenance router. The older `maintenance.hono.ts`
 * used to point at a stub; callers may still import from here.
 */
export { maintenanceRouter } from './maintenance';
