/**
 * @bossnyumba/compliance-pack — public surface.
 *
 * Bundles 10 framework control catalogs + DSAR automation + erasure
 * cascade with legal-hold + envelope encryption + residency policy +
 * breach notification. Pure functions, no DB / KMS dependency at the
 * type level.
 *
 * Quick start:
 *   import {
 *     ALL_CATALOGS,
 *     controlsByJurisdiction,
 *     createDSARService,
 *     createInMemoryEnvelopeEncryptor,
 *     buildErasureCascade,
 *     checkResidency,
 *     requiredNotifications,
 *   } from '@bossnyumba/compliance-pack';
 */

export * from './types.js';
export * from './frameworks/index.js';
export * from './dsar/index.js';
export * from './erasure-cascade/index.js';
