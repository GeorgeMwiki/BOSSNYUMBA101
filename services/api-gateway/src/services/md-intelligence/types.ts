/**
 * MD-Intelligence — shared cross-domain types (real-estate edition).
 *
 * Ported from Borjie's `services/domain-depth/types.ts` and retargeted
 * from mining to real estate. BossNyumba does not (yet) ship a full
 * domain-depth catalog service, so the MD-Intelligence engine carries
 * the small slice of types it actually needs — `DomainId`,
 * `SubAreaStatusTone`, and `SubAreaStatus` — self-contained here. When a
 * BN domain-depth service lands, these can be promoted to a shared
 * module without touching the engine call-sites.
 *
 * VOCAB RETARGET applied vs Borjie:
 *   - geology   → maintenance   (the physical-asset upkeep domain)
 *   - licences  → leasing       (lease lifecycle, the BN analogue of
 *                                mineral-licence lifecycle)
 * Already-neutral domains are kept verbatim: compliance, finance,
 * operations, hr, marketing, risk, treasury, marketplace, holdings,
 * subsidiaries, succession, asset-register.
 *
 * Rent / arrears / occupancy / collections are modelled as SUB-AREAS
 * (dotted `<domain>.<sub_area>` node ids inside the signal graph) rather
 * than top-level domains — mirroring how Borjie modelled
 * production / tonnage as sub-areas, not domains. This keeps the engine
 * structure byte-for-byte while the vocabulary becomes real-estate.
 */

/** Stable real-estate-OS domain ids the signal graph covers. */
export type DomainId =
  | 'compliance'
  | 'finance'
  | 'operations'
  | 'hr'
  | 'marketing'
  | 'risk'
  | 'treasury'
  | 'maintenance'
  | 'marketplace'
  | 'leasing'
  | 'holdings'
  | 'subsidiaries'
  | 'succession'
  | 'asset-register';

/** Status tone surfaced to the FE. */
export type SubAreaStatusTone = 'green' | 'amber' | 'red' | 'unknown';

/**
 * Runtime status returned by a (future) domain resolver for a given
 * landlord + scope. Resolvers never throw — failure paths return
 * `{ status: 'unknown' }` so the insight emitter renders an honest
 * "no signal yet" instead of fabricating.
 */
export interface SubAreaStatus {
  readonly status: SubAreaStatusTone;
  readonly dueAt?: string;
  readonly lastFiledAt?: string;
  readonly refNumber?: string;
  readonly evidenceDocId?: string;
  readonly note?: string;
}
