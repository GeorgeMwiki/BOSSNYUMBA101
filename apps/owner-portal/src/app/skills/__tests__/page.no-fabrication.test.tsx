/**
 * Wave-D no-fabrication detectors for /skills.
 *
 * These tests lock in the doctrine fix: the page must NEVER render a
 * fabricated sample catalog. On any API failure it shows an honest
 * missing/error notice; on an empty (but ok) response it shows an honest
 * empty-state. The install/toggle/run controls only ever act on real
 * API-loaded skills.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

// next-intl passthrough: translator returns the key so assertions are stable.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import SkillsPage from '../page';

// Names that ONLY ever existed in the removed SAMPLE_SKILLS fixture. If any
// of these reappear, fabricated data has leaked back in.
const FABRICATED_NAMES = [
  'Arrears Friday digest',
  'KRA monthly filing compiler',
  'Lease renewal early-warning',
  'Vendor SLA call-out',
  'Owner monthly newsletter',
  'Eviction checklist runner',
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function expectNoFabricatedSkills(): void {
  for (const name of FABRICATED_NAMES) {
    expect(screen.queryByText(name)).toBeNull();
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SkillsPage — no fabricated fallback', () => {
  it('renders an honest notice (no sample skills) on a non-503 API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, 500)),
    );

    render(<SkillsPage />);

    await waitFor(() => {
      // MissingBackendNotice surfaces the concrete endpoint.
      expect(screen.getByText('/api/v1/owner/skills')).toBeInTheDocument();
    });
    expectNoFabricatedSkills();
  });

  it('renders the missing-backend notice on a 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'not wired' }, 503)),
    );

    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText('/api/v1/owner/skills')).toBeInTheDocument();
    });
    expectNoFabricatedSkills();
  });

  it('renders an honest notice (no sample skills) on a network throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText('/api/v1/owner/skills')).toBeInTheDocument();
    });
    expectNoFabricatedSkills();
  });

  it('renders an honest empty-state (no fabricated rows) when the API returns zero skills', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ skills: [] }, 200)),
    );

    render(<SkillsPage />);

    // The marketplace header renders once real (empty) data resolves.
    await waitFor(() => {
      expect(screen.getByText(/Installed \(0\)/)).toBeInTheDocument();
    });
    expectNoFabricatedSkills();
  });

  it('renders ONLY the real skills returned by the API', async () => {
    const realSkill = {
      id: 'real-1',
      name: 'Real owner skill',
      slug: 'real-owner-skill',
      description: 'A genuine skill from the live API.',
      author: 'Mr. Mwikila',
      authorIsMd: true,
      category: 'arrears',
      triggerKind: 'cron',
      installed: true,
      enabled: true,
      runCount: 2,
      rating: 4.5,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ skills: [realSkill] }, 200)),
    );

    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText('Real owner skill')).toBeInTheDocument();
    });
    expectNoFabricatedSkills();
  });
});
