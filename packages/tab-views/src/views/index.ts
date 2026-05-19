/**
 * @bossnyumba/tab-views/views — public surface for the 6 sample
 * TabView implementations.
 */

export { EmployeeTableView } from './employee-table-view.js';
export type {
  EmployeeQuery,
  EmployeeRow,
  EmployeeData,
  EmployeeSortField,
} from './employee-table-view.js';

export { PropertyKpiGridView } from './property-kpi-grid-view.js';
export type {
  PropertyKpiQuery,
  PropertyKpiData,
  PropertyKpiPeriod,
} from './property-kpi-grid-view.js';

export { LeaseTimelineView } from './lease-timeline-view.js';
export type {
  LeaseQuery,
  LeaseData,
  LeaseEvent,
  LeaseEventCategory,
} from './lease-timeline-view.js';

export { ArrearsTableView } from './arrears-table-view.js';
export type {
  ArrearsQuery,
  ArrearsRow,
  ArrearsData,
  ArrearsSortField,
} from './arrears-table-view.js';

export { KraFilingProfileCardView } from './kra-filing-profile-card-view.js';
export type {
  KraFilingQuery,
  KraFilingData,
  KraFilingStatus,
} from './kra-filing-profile-card-view.js';

export { RecommendationListView } from './recommendation-list-view.js';
export type {
  RecommendationQuery,
  RecommendationRow,
  RecommendationData,
  RecommendationStatus,
} from './recommendation-list-view.js';
