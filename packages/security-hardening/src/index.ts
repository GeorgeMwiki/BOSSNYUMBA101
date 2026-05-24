/**
 * @bossnyumba/security-hardening
 *
 * Public surface — every subsystem is independently importable from the
 * deep paths so callers can tree-shake unused subsystems.
 *
 * For a one-stop factory, use `createSecurityHardening(...)`.
 */

export * from './types.js';
export * from './webauthn/index.js';
export * from './mfa/index.js';
