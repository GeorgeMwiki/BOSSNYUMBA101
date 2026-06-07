import { z } from 'zod'

export const inspectionKindSchema = z.enum(['move_in', 'move_out', 'routine'])
export type InspectionKind = z.infer<typeof inspectionKindSchema>

export const inspectionItemSchema = z.object({
  id: z.string(),
  type: z.string().trim().min(1).max(60),
  fromMeters: z.number().min(0),
  toMeters: z.number().min(0)
}).refine((item) => item.toMeters > item.fromMeters, {
  message: 'invalid_range'
})

export type InspectionItemInput = z.input<typeof inspectionItemSchema>
export type InspectionItem = z.infer<typeof inspectionItemSchema>

export const inspectionFormSchema = z.object({
  inspectionId: z.string().trim().min(3).max(40),
  kind: inspectionKindSchema,
  depth: z.string().trim().regex(/^\d+(\.\d+)?$/u),
  assetTag: z.string().trim().max(40).optional().default('')
})

export type InspectionForm = z.infer<typeof inspectionFormSchema>

export interface InspectionPayload {
  inspectionId: string
  kind: InspectionKind
  depthMeters: number
  assetTag: string
  items: ReadonlyArray<InspectionItem>
  gps: {
    latitude: number
    longitude: number
    accuracy: number | null
    capturedAt: number
  } | null
  fence: {
    siteId: string
    siteName: string
    insideFence: boolean
    distanceMeters: number
  } | null
  submittedAt: number
}

/**
 * Generate an inspection id of the form INS-YYYY-NNNN where the numeric suffix
 * is the day-of-year plus a 2-char random suffix. Deterministic enough that the
 * field worker can read it back, random enough to avoid same-shift collision.
 */
export function generateInspectionId(now: Date = new Date()): string {
  const year = now.getFullYear()
  const startOfYear = new Date(Date.UTC(year, 0, 0))
  const diffMs = now.getTime() - startOfYear.getTime()
  const dayOfYear = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  // eslint-disable-next-line no-restricted-syntax -- React Native client-local inspection ref suffix (no Web Crypto); uniqueness suffices, not security-sensitive
  const suffix = Math.random().toString(36).slice(2, 4).toUpperCase()
  const dayPart = String(dayOfYear).padStart(3, '0')
  return `INS-${year}-${dayPart}${suffix}`
}
