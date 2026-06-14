/**
 * /status — honesty detector (Wave D).
 *
 * The page previously hardcoded "all systems operational" and framed it
 * as LIVE SRE telemetry: "Updated every 60 seconds from our SRE
 * telemetry", "Reported 60 seconds ago", "99.97% uptime". No live data
 * backed any of it. A real `StatusBoard` exists but its gateway endpoint
 * (`GET /api/v1/public/status`) is not mounted, so the honest choice is
 * a static service catalogue with no fabricated telemetry.
 *
 * These tests fail if the fabricated live-telemetry framing returns.
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import StatusPage from '../page';

function renderText(): string {
  const { container } = render(<StatusPage />);
  return container.textContent ?? '';
}

describe('/status — no fabricated live telemetry (Wave D)', () => {
  it('does NOT claim live SRE telemetry updated every 60 seconds', () => {
    const text = renderText();
    expect(text).not.toMatch(/SRE telemetry/i);
    expect(text).not.toMatch(/every 60 seconds/i);
    expect(text).not.toMatch(/Reported 60 seconds ago/i);
  });

  it('does NOT fabricate a specific uptime number', () => {
    const text = renderText();
    expect(text).not.toMatch(/99\.97% uptime/i);
  });

  it('does NOT present a faked "all systems operational" live banner', () => {
    const text = renderText();
    expect(text).not.toMatch(/All systems operational/i);
  });

  it('still honestly lists the platform services', () => {
    const text = renderText();
    expect(text).toMatch(/API gateway/i);
    expect(text).toMatch(/Master Brain/i);
    expect(text).toMatch(/Audit chain/i);
  });
});
