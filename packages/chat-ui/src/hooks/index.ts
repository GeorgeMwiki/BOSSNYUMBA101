/**
 * Chat-UI hooks barrel.
 *
 * Hooks live separately from components so consumers (Next.js app router
 * + Vite SPAs) can import them without dragging in the heavier SVG /
 * Blackboard tree when they only need the SSE plumbing.
 */
export * from './useChatStream.js';
