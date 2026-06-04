import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'
import { z } from 'zod'
import { managerApi, ownerApi } from '../api/client'
import { ApiError } from '../api/errors'
import type {
  Lease,
  LeaseBucket,
  LeaseRenewalResponse,
  LeasesResponse
} from './types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Pure: compute integer days from `now` until `expiresAt`. Negative when
 * already expired. Floor-rounded so the count ticks down once per
 * midnight relative to `now`.
 */
export function daysUntilExpiry(expiresAt: string, now: number = Date.now()): number {
  const target = Date.parse(expiresAt)
  if (!Number.isFinite(target)) {
    return Number.NaN
  }
  return Math.floor((target - now) / MS_PER_DAY)
}

/**
 * Pure: classify a days-to-expiry value into the four buckets. Caller
 * passes `daysLeft` from server OR a fresh `daysUntilExpiry(...)` call;
 * we deliberately accept the number so the function stays trivially
 * testable.
 */
export function classifyBucket(daysLeft: number): LeaseBucket {
  if (!Number.isFinite(daysLeft) || daysLeft < 0) {
    return 'expired'
  }
  if (daysLeft <= 7) {
    return 't7'
  }
  if (daysLeft <= 30) {
    return 't30'
  }
  return 't90'
}

const FALLBACK: LeasesResponse = {
  generatedAt: new Date().toISOString(),
  leases: [
    {
      id: 'l-12345',
      leaseRef: 'LSE-12345',
      propertyName: 'Oyster Bay Block A',
      unitLabel: 'Unit 2',
      expiresOn: '2026-08-12',
      expiresAt: '2026-08-12T00:00:00Z',
      daysLeft: 79,
      bucket: 't90'
    },
    {
      id: 'l-67890',
      leaseRef: 'LSE-67890',
      propertyName: 'Masaki Court',
      unitLabel: 'Unit A',
      expiresOn: '2026-06-22',
      expiresAt: '2026-06-22T00:00:00Z',
      daysLeft: 28,
      bucket: 't30'
    },
    {
      id: 'l-24680',
      leaseRef: 'LSE-24680',
      propertyName: 'Mikocheni East',
      unitLabel: 'Unit 5',
      expiresOn: '2026-06-01',
      expiresAt: '2026-06-01T00:00:00Z',
      daysLeft: 7,
      bucket: 't7'
    }
  ]
}

/**
 * Owner lease calendar. Bucket + daysLeft are recomputed defensively
 * on the client from `expiresAt` (falling back to `expiresOn`) against
 * Date.now() so stale server values can never out-of-sync the UI.
 *
 * Expiry/renewal tracking is a compliance concern (GET /api/v1/compliance);
 * the legacy single-resource lease endpoint shape is preserved here and
 * the exact compliance contract is flagged for follow-up.
 */
export function useLeases(): UseQueryResult<LeasesResponse, Error> {
  return useQuery<LeasesResponse, Error>({
    queryKey: ['owner', 'leases'],
    queryFn: async ({ signal }) => {
      try {
        const response = await ownerApi.get<LeasesResponse>('/leases', {
          signal
        })
        return {
          ...response,
          leases: response.leases.map(reconcileLease)
        }
      } catch (error) {
        if (error instanceof ApiError && (error.status === 0 || error.status === 404)) {
          return {
            ...FALLBACK,
            leases: FALLBACK.leases.map(reconcileLease)
          }
        }
        throw error
      }
    },
    staleTime: 5 * 60_000
  })
}

function reconcileLease(lease: Lease): Lease {
  const isoExpiry = lease.expiresAt ?? lease.expiresOn
  const computed = daysUntilExpiry(isoExpiry)
  const daysLeft = Number.isFinite(computed) ? computed : lease.daysLeft
  return {
    ...lease,
    daysLeft,
    bucket: classifyBucket(daysLeft)
  }
}

export function groupByBucket(
  leases: ReadonlyArray<Lease>
): Readonly<Record<LeaseBucket, ReadonlyArray<Lease>>> {
  const t7: Lease[] = []
  const t30: Lease[] = []
  const t90: Lease[] = []
  const expired: Lease[] = []
  for (const lease of leases) {
    if (lease.bucket === 't7') {
      t7.push(lease)
    } else if (lease.bucket === 't30') {
      t30.push(lease)
    } else if (lease.bucket === 't90') {
      t90.push(lease)
    } else {
      expired.push(lease)
    }
  }
  return { t7, t30, t90, expired }
}

const RenewalResponseSchema = z.object({
  renewalId: z.string().min(1),
  leaseId: z.string().min(1),
  status: z.enum(['queued', 'submitted', 'accepted']),
  submittedAt: z.string().min(1)
})

/**
 * Lease-renewal mutation. Posts the renewal request and invalidates the
 * leases query on success so the calendar refreshes.
 */
export function useRenewLease(): UseMutationResult<
  LeaseRenewalResponse,
  Error,
  string
> {
  const queryClient = useQueryClient()
  return useMutation<LeaseRenewalResponse, Error, string>({
    mutationFn: async (leaseId: string) => {
      const response = await managerApi.post<unknown>(
        `/leases/${encodeURIComponent(leaseId)}/renew`,
        {}
      )
      const parsed = RenewalResponseSchema.safeParse(response)
      if (!parsed.success) {
        throw new Error('Renewal response failed schema validation')
      }
      return parsed.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['owner', 'leases'] })
    }
  })
}
