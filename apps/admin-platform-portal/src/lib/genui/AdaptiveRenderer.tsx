/**
 * Re-export shim — kept so existing admin-platform-portal imports
 * (`@/lib/genui/AdaptiveRenderer`) continue to resolve. The renderer
 * + every primitive now lives in `@bossnyumba/genui`, shared with the
 * owner-portal web SPA.
 */
export { AdaptiveRenderer } from '@bossnyumba/genui';
export type {
  AdaptiveRendererProps,
  AdaptiveRendererSingleProps,
  AdaptiveRendererListProps,
} from '@bossnyumba/genui';
