import { z } from 'zod'

export const placeBidSchema = z.object({
  bidPrice: z
    .string()
    .min(1, 'required')
    // The gateway requires a whole-number offer (no minor units on the bid
    // rail), so a decimal/grouped value must fail FE-side with a clear,
    // translated reason rather than 400ing post-submit. Digits only, no
    // decimal separator or grouping.
    .regex(/^\d+$/, 'integer'),
  paymentTerms: z.enum(['instant', '30d', '60d']),
  notes: z.string().max(500).optional().default(''),
  termsAccepted: z.boolean().refine((val) => val === true, { message: 'required' })
})

export type PlaceBidFormInput = z.input<typeof placeBidSchema>
export type PlaceBidFormValues = z.output<typeof placeBidSchema>

export function parseBidPrice(raw: string): number {
  // The schema guarantees a digits-only string, so this is always a safe
  // whole-number parse that matches the gateway's integer bid contract.
  return Number.parseInt(raw, 10)
}
