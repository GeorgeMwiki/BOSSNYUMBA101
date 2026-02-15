/**
 * AI Services
 * 
 * Core services for the BOSSNYUMBA AI Copilot package.
 * Includes all intelligence layer services from Module C.
 */

// Base Services
export * from './base-copilot.js';
export * from './review-service.js';

// Existing AI Services
export * from './maintenance-triage.js';
export * from './churn-predictor.js';
export * from './payment-risk.js';
export * from './next-best-action.js';
export * from './sentiment-analyzer.js';
export * from './vendor-matcher.js';
export * from './renewal-optimizer.js';

// ============================================
// Module C: AI Personalization Engine Services
// ============================================

// Workflow C.1: Tenant Preference Profile Engine
export * from './preference-profile-engine.js';

// Workflow C.2: Friction Fingerprint Analyzer
export * from './friction-fingerprint-analyzer.js';

// Workflow C.3: NBA Manager Queue (Enhanced Next Best Action)
export * from './nba-manager-queue.js';

// Risk Scoring Models
export * from './risk-scoring.js';

// Enhanced Renewal Strategy Generator
export * from './renewal-strategy-generator.js';

// Conversational Personalization
export * from './conversational-personalization.js';
