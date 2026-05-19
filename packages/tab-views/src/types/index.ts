/**
 * @bossnyumba/tab-views/types — public type surface.
 */

export type { AgUiPartKind, AgUiUiPart } from './ag-ui.js';
export type { Principal, PrincipalKind } from './principal.js';
export { internalAdmin, ownerCustomer } from './principal.js';
export type { Citation, CitationConfidence, CitedRow } from './citation.js';
export type {
  TabView,
  ViewKind,
  RenderContext,
  ViewPreference,
  PreferenceScope,
  QueryValidation,
  QueryValidationError,
} from './tab-view.js';
