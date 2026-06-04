import { describe, it, expect } from 'vitest';
import {
  buildMainMenu,
  buildMenuTree,
  buildLeaseScreen,
  buildRentScreen,
  buildMeterReadingConfirm,
  buildMarketplaceScreen,
  buildLanguageMenu,
  buildErrorScreen,
  truncateToUssd,
  tierSatisfies,
} from './menu-tree';
import { USSD_MAX_CHARS } from './types';

describe('truncateToUssd', () => {
  it('passes short text through unchanged', () => {
    expect(truncateToUssd('hello')).toBe('hello');
  });

  it('clamps to the screen budget with an ellipsis', () => {
    const long = 'x'.repeat(300);
    const out = truncateToUssd(long);
    expect(out.length).toBe(USSD_MAX_CHARS);
    expect(out.endsWith('...')).toBe(true);
  });
});

describe('tierSatisfies', () => {
  it('owner satisfies every required tier', () => {
    expect(tierSatisfies('owner', 'agent')).toBe(true);
    expect(tierSatisfies('owner', 'manager')).toBe(true);
    expect(tierSatisfies('owner', 'anonymous')).toBe(true);
  });

  it('anonymous only satisfies anonymous', () => {
    expect(tierSatisfies('anonymous', 'anonymous')).toBe(true);
    expect(tierSatisfies('anonymous', 'tenant')).toBe(false);
  });

  it('tenant does not satisfy manager-only', () => {
    expect(tierSatisfies('tenant', 'manager')).toBe(false);
  });
});

describe('buildMainMenu tier filtering', () => {
  it('shows only the vacant units + language to an anonymous caller', () => {
    const menu = buildMainMenu('en', 'anonymous');
    expect(menu).toContain('Vacant Units');
    expect(menu).toContain('Language');
    expect(menu).not.toContain('My Lease');
    expect(menu).not.toContain('Rent Due');
  });

  it('shows lease/rent/reading/maintenance to a tenant', () => {
    const menu = buildMainMenu('en', 'tenant');
    expect(menu).toContain('My Lease');
    expect(menu).toContain('Rent Due');
    expect(menu).toContain('Submit Reading');
    expect(menu).toContain('Maintenance');
  });

  it('shows everything to an owner', () => {
    const menu = buildMainMenu('en', 'owner');
    expect(menu).toContain('My Lease');
    expect(menu).toContain('Rent Due');
    expect(menu).toContain('Submit Reading');
    expect(menu).toContain('Vacant Units');
  });

  it('keeps option keys stable when an option is hidden', () => {
    // Anonymous cannot see lease (key 1) but vacant units keeps key 5.
    const menu = buildMainMenu('en', 'anonymous');
    expect(menu).toContain('5. Vacant Units');
    expect(menu).not.toContain('1. My Lease');
  });
});

describe('single-language guarantee (zero-mix)', () => {
  it('renders the Swahili main menu with no English option labels', () => {
    const menu = buildMainMenu('sw', 'owner');
    expect(menu).toContain('Mkataba Wangu');
    expect(menu).toContain('Kodi');
    expect(menu).not.toContain('My Lease');
    expect(menu).not.toContain('Rent Due');
  });

  it('renders an English error with no Swahili', () => {
    const screen = buildErrorScreen('invalid', 'en');
    expect(screen).toBe('Invalid choice. Try again.');
    expect(screen).not.toMatch(/batili/);
  });
});

describe('dynamic screens', () => {
  it('renders a lease screen', () => {
    const screen = buildLeaseScreen(
      {
        leaseRef: 'LSE-00421',
        statusEn: 'Active',
        statusSw: 'Hai',
        expiresOn: '2027-01-15',
        daysToExpiry: 590,
      },
      'en',
    );
    expect(screen).toContain('LSE-00421');
    expect(screen).toContain('Active');
    expect(screen).toContain('590 days left');
  });

  it('renders a rent screen with rendered currency strings', () => {
    const screen = buildRentScreen(
      {
        periodLabel: 'May 2026',
        amountDueDisplay: 'TZS 1,200,000',
        amountPaidDisplay: 'TZS 0',
        nextActionEn: 'Pay before 30th',
        nextActionSw: 'Lipa kabla ya 30',
      },
      'en',
    );
    expect(screen).toContain('TZS 1,200,000');
    expect(screen).toContain('Pay before 30th');
  });

  it('renders a meter-reading confirmation', () => {
    const screen = buildMeterReadingConfirm(45, 'sw');
    expect(screen).toContain('45u');
    expect(screen).toContain('Ndiyo');
    expect(screen).toContain('Hapana');
  });

  it('renders a marketplace list and an empty state', () => {
    const filled = buildMarketplaceScreen(
      [
        { unitEn: 'Studio A1', unitSw: 'Studio A1', priceDisplay: 'TZS 150k/mo' },
        { unitEn: '2-Bed B4', unitSw: 'Vyumba 2 B4', priceDisplay: 'TZS 350k/mo' },
      ],
      'en',
    );
    expect(filled).toContain('1. Studio A1 TZS 150k/mo');
    expect(filled).toContain('2. 2-Bed B4');

    const empty = buildMarketplaceScreen([], 'en');
    expect(empty).toContain('No vacant units available');
  });
});

describe('buildMenuTree', () => {
  it('exposes a root and dynamic leaf nodes', () => {
    const tree = buildMenuTree();
    expect(tree.root.id).toBe('main_menu');
    expect(tree.nodes.lease?.isDynamic).toBe(true);
    expect(tree.nodes.rent?.isDynamic).toBe(true);
    expect(tree.nodes.language_switch?.options).toHaveLength(2);
  });
});

describe('buildLanguageMenu', () => {
  it('is the one bilingual screen (no language set yet)', () => {
    const menu = buildLanguageMenu();
    expect(menu).toContain('English');
    expect(menu).toContain('Kiswahili');
  });
});
