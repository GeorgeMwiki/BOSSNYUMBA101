import type { Bid } from '@/types/listing'

// Tenant performance is derived client-side from application history per
// §6 of the SOTA spec: win rate (rolling 90d), response time (median
// time-to-counter when the tenant is responding to a counter offer), and
// deal volume (sum of accepted-application notional). No dedicated
// endpoint exists yet — when one lands, this module remains the single
// read-side aggregator.

export interface TenantPerformanceSummary {
  readonly bidsPlaced: number
  readonly bidsAccepted: number
  readonly winRatePct: number
  readonly medianResponseMs: number | null
  readonly dealVolumeTzs: number
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

function isWithinWindow(iso: string, now: number, windowMs: number): boolean {
  const placed = Date.parse(iso)
  if (Number.isNaN(placed)) {
    return false
  }
  return now - placed <= windowMs
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const isOdd = sorted.length % 2 === 1
  const left = sorted[mid - (isOdd ? 0 : 1)]
  const right = sorted[mid]
  if (left === undefined || right === undefined) {
    return null
  }
  return isOdd ? right : (left + right) / 2
}

function tenantResponseLatencies(bid: Bid): readonly number[] {
  // Median time from a landlord's last message to the tenant's next reply.
  // Bound at the application level so a single hot thread can't dominate.
  const out: number[] = []
  let lastLandlordAt: number | null = null
  for (const message of bid.thread) {
    const ts = Date.parse(message.sentAt)
    if (Number.isNaN(ts)) {
      continue
    }
    if (message.from === 'landlord') {
      lastLandlordAt = ts
    } else if (lastLandlordAt !== null) {
      const delta = ts - lastLandlordAt
      if (delta >= 0) {
        out.push(delta)
      }
      lastLandlordAt = null
    }
  }
  return out
}

export function summariseTenantPerformance(
  bids: readonly Bid[],
  now: number = Date.now()
): TenantPerformanceSummary {
  const recent = bids.filter((bid) => isWithinWindow(bid.placedAt, now, NINETY_DAYS_MS))
  const accepted = recent.filter((bid) => bid.status === 'accepted')
  const bidsPlaced = recent.length
  const bidsAccepted = accepted.length
  const winRatePct = bidsPlaced === 0 ? 0 : Math.round((bidsAccepted / bidsPlaced) * 100)
  const latencies = recent.flatMap(tenantResponseLatencies)
  const medianResponseMs = median(latencies)
  const dealVolumeTzs = accepted.reduce(
    (sum, bid) => sum + bid.offerRentPerMonthTzs,
    0
  )
  return {
    bidsPlaced,
    bidsAccepted,
    winRatePct,
    medianResponseMs,
    dealVolumeTzs
  }
}

export function formatResponseLatency(ms: number | null): string {
  if (ms === null) {
    return '—'
  }
  if (ms < 60_000) {
    return `${Math.max(1, Math.round(ms / 1000))}s`
  }
  if (ms < 60 * 60_000) {
    return `${Math.round(ms / 60_000)}m`
  }
  if (ms < 24 * 60 * 60_000) {
    return `${Math.round(ms / (60 * 60_000))}h`
  }
  return `${Math.round(ms / (24 * 60 * 60_000))}d`
}
