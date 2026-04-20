/**
 * SystemHealthPage — Wave-12 shim that re-exports the new SystemHealth
 * component from ./SystemHealth.tsx while keeping the existing import
 * path stable for App.tsx.
 */

export { SystemHealth as SystemHealthPage } from './SystemHealth';
export { default } from './SystemHealth';
