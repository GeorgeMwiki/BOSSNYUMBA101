/**
 * Final-sweep honest-degrade detector for the persona-drift dashboard.
 *
 * The read route `GET /api/v1/persona-drift/events` is not yet mounted in
 * the api-gateway (only the cron *writer* exists). The client must treat a
 * 404/501 as a known deferred-backend state ("unavailable") and render an
 * honest amber notice — NOT a scary red error box that re-appears every
 * 60s poll. This locks in the status-classification that drives that path.
 *
 * Dependency-light (`.ts`, no DOM / RTL) so it runs under the admin
 * portal's `src/app/**\/__tests__/**\/*.test.ts` include on a fresh
 * checkout without app-level UI deps installed.
 */

import { describe, it, expect } from 'vitest';
import { isBackendUnavailableStatus } from '../PersonaDriftClient';

describe('persona-drift — backend-unavailable classification', () => {
  it('treats 404 (route not mounted) as backend-unavailable', () => {
    expect(isBackendUnavailableStatus(404)).toBe(true);
  });

  it('treats 501 (not implemented) as backend-unavailable', () => {
    expect(isBackendUnavailableStatus(501)).toBe(true);
  });

  it('does NOT treat 200 as unavailable', () => {
    expect(isBackendUnavailableStatus(200)).toBe(false);
  });

  it('does NOT swallow genuine 5xx failures as unavailable', () => {
    expect(isBackendUnavailableStatus(500)).toBe(false);
    expect(isBackendUnavailableStatus(503)).toBe(false);
  });

  it('does NOT treat auth failures as unavailable', () => {
    expect(isBackendUnavailableStatus(401)).toBe(false);
    expect(isBackendUnavailableStatus(403)).toBe(false);
  });
});
