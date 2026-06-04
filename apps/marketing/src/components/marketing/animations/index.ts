/**
 * Marketing animations barrel — carbon copy of the upstream fork's marketing/animations
 * folder, re-exporting BN's existing animation primitives so the upstream marketing fork
 * import path (`@/components/marketing/animations/...`) resolves correctly
 * without duplicating components.
 */

export { ScrollProgressBar } from '@/components/animations/ScrollProgressBar';
export { StaggerReveal } from '@/components/animations/StaggerReveal';
export { TiltCard } from '@/components/animations/TiltCard';
export { CountUp } from '@/components/animations/CountUp';
