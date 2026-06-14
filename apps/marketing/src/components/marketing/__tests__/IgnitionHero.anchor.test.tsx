/**
 * IgnitionHero — "See it move" anchor resolves on-page (Wave D).
 *
 * The secondary CTA pointed at `#how-it-works`, but the home page has no
 * element with that id (it only exists on the /for-* audience pages), so
 * the anchor was dead. The fix points the CTA at the hero's own live
 * demo panel (`#mwikila-live-demo`), which exists on the home page.
 *
 * This test mounts the hero and asserts the CTA's href target id is
 * actually present in the rendered DOM — a real, resolving anchor.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@bossnyumba/design-system', () => ({
  Logomark: () => <div data-testid="logomark" />,
}));

vi.mock('@bossnyumba/chat-ui', () => ({
  CHAT_HEADER_GRADIENT: '',
  CHAT_USER_BUBBLE: '',
  CHAT_AI_BUBBLE: '',
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...rest }: { children?: React.ReactNode }) => (
          <div {...rest}>{children}</div>
        ),
    },
  ),
}));

import { IgnitionHero } from '../IgnitionHero';

describe('IgnitionHero — secondary CTA anchor (Wave D)', () => {
  it('the "See it move" CTA points at an id that exists on the page', () => {
    const { container } = render(<IgnitionHero locale="en" />);
    const cta = screen.getByRole('link', { name: /see it move/i });
    const href = cta.getAttribute('href') ?? '';
    expect(href.startsWith('#')).toBe(true);
    const targetId = href.slice(1);
    expect(targetId.length).toBeGreaterThan(0);
    expect(
      container.querySelector(`#${targetId}`),
      `anchor target #${targetId} must exist on the page`,
    ).not.toBeNull();
  });

  it('does NOT point at the dead #how-it-works anchor', () => {
    render(<IgnitionHero locale="en" />);
    const cta = screen.getByRole('link', { name: /see it move/i });
    expect(cta.getAttribute('href')).not.toBe('#how-it-works');
  });
});
