/**
 * OrgCard / ListingCard render tests — confirm the headline data is
 * visible to assistive tech and the card links to the right route.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrgCard } from './OrgCard';
import { ListingCard } from './ListingCard';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));

describe('OrgCard', () => {
  it('renders the org name + listing count', () => {
    render(
      <OrgCard
        org={{
          orgId: 'org_a',
          name: 'Asha Properties',
          slug: 'asha-properties',
          description: 'A friendly portfolio.',
          city: 'Nairobi',
          country: 'KE',
          listingCount: 3,
          tenderCount: 1,
        }}
      />,
    );
    expect(screen.getByText('Asha Properties')).toBeInTheDocument();
    expect(screen.getByText(/3 listings/i)).toBeInTheDocument();
    expect(screen.getByText(/Nairobi/i)).toBeInTheDocument();
  });

  it('links to the org detail page', () => {
    render(
      <OrgCard
        org={{
          orgId: 'org_a',
          name: 'A',
          slug: 'a',
          description: null,
          city: null,
          country: null,
          listingCount: 1,
          tenderCount: 0,
        }}
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/marketplace/orgs/org_a');
  });
});

describe('ListingCard', () => {
  it('renders the property name + city + price', () => {
    render(
      <ListingCard
        listing={{
          listingId: 'lst_x',
          orgId: 'org_a',
          orgName: 'Asha Properties',
          propertyId: 'prop_x',
          propertyName: 'Riverside A',
          unitId: 'u_a1',
          unitName: 'A1',
          city: 'Nairobi',
          country: 'KE',
          type: 'apartment',
          bedrooms: 2,
          bathrooms: 1,
          squareMeters: 65,
          priceMin: 45000,
          priceMax: 55000,
          currency: 'KES',
          negotiable: true,
          furnishing: 'semi_furnished',
          amenities: ['parking'],
          thumbnailUrl: null,
        }}
      />,
    );
    expect(screen.getByText('Riverside A')).toBeInTheDocument();
    expect(screen.getByText(/Asha Properties · Nairobi/i)).toBeInTheDocument();
    expect(screen.getByText(/2 bed/i)).toBeInTheDocument();
    expect(screen.getByText(/65 m²/i)).toBeInTheDocument();
    expect(screen.getByText(/Negotiable/i)).toBeInTheDocument();
  });

  it('links to the listing detail page', () => {
    render(
      <ListingCard
        listing={{
          listingId: 'lst_x',
          orgId: 'org_a',
          orgName: 'A',
          propertyId: 'p',
          propertyName: 'P',
          unitId: 'u',
          unitName: 'U',
          city: 'X',
          country: 'KE',
          type: 'apartment',
          bedrooms: 1,
          bathrooms: 1,
          squareMeters: null,
          priceMin: 1,
          priceMax: 1,
          currency: 'KES',
          negotiable: false,
          furnishing: null,
          amenities: [],
          thumbnailUrl: null,
        }}
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/marketplace/listings/lst_x');
  });
});
