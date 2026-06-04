import type { ListingFilters } from './marketplace'

export const queryKeys = {
  listings: (filters: ListingFilters) => ['listings', filters] as const,
  listing: (id: string) => ['listing', id] as const,
  bids: () => ['bids'] as const,
  bid: (id: string) => ['bid', id] as const,
  documents: () => ['documents'] as const,
  document: (id: string) => ['document', id] as const,
  kycStatus: (id: string) => ['kyc-status', id] as const,
  // R11 — applicant-initiated request for applications.
  rfbsMine: () => ['rfbs', 'mine'] as const,
  // Commercial chain L7 — tenant notifications.
  tenantNotifications: (unreadOnly: boolean) =>
    ['tenant-notifications', unreadOnly ? 'unread' : 'all'] as const,
} as const
