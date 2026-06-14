/**
 * /book-demo — CTA hierarchy + safe external link (Wave D).
 *
 * The page shipped three equally-weighted filled CTAs (no hierarchy) and
 * an external cal.com link with no target/rel. The fix makes the calendar
 * the single primary CTA, demotes the others to secondary, and renders
 * the external link as a real `<a target="_blank" rel="noopener
 * noreferrer">`.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import BookDemoPage from '../page';

describe('/book-demo — CTA hierarchy + external safety (Wave D)', () => {
  it('the external calendar link opens in a new tab with safe rel', () => {
    render(<BookDemoPage />);
    const calLink = screen.getByRole('link', { name: /open calendar/i });
    expect(calLink).toHaveAttribute('href', expect.stringContaining('cal.com'));
    expect(calLink).toHaveAttribute('target', '_blank');
    expect(calLink.getAttribute('rel') ?? '').toMatch(/noopener/);
    expect(calLink.getAttribute('rel') ?? '').toMatch(/noreferrer/);
  });

  it('exactly one CTA is the filled primary (the calendar)', () => {
    const { container } = render(<BookDemoPage />);
    const primaryButtons = container.querySelectorAll('a.bg-signal-500');
    expect(primaryButtons.length).toBe(1);
    expect((primaryButtons[0]?.textContent ?? '').toLowerCase()).toContain(
      'open calendar',
    );
  });

  it('still exposes the chat and phone channels as secondary CTAs', () => {
    render(<BookDemoPage />);
    expect(
      screen.getByRole('link', { name: /sign up \+ chat/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /call \+255/i }),
    ).toBeInTheDocument();
  });
});
