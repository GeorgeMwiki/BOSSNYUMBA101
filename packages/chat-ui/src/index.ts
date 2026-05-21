export * from './chat-modes';
export * from './generative-ui';
export * from './blackboard';
export * from './hooks';
export * from './widget';
export * from './voice';
// Shared brain-degraded UI marker — consumed by customer-app/brain-degraded.ts.
export { DegradedBanner } from './components/DegradedBanner';
export type { DegradedBannerProps, DegradedMarker } from './components/DegradedBanner';
export * as Dopamine from './dopamine/index.js';
