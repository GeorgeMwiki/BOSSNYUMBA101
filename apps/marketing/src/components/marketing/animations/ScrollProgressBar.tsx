/**
 * Re-export shim — keeps the upstream fork's
 * `@/components/marketing/animations/ScrollProgressBar` import path
 * intact while sourcing from BN's existing animations module. Avoids
 * duplicating the IntersectionObserver-based progress bar logic.
 */
export { ScrollProgressBar } from '@/components/animations/ScrollProgressBar';
