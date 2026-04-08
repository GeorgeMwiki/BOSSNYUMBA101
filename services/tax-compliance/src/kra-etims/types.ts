import { z } from 'zod';

/**
 * KRA eTIMS OSCU (Online Sales Control Unit) types.
 *
 * References:
 *  - KRA eTIMS integration spec (OSCU/VSCU) — JSON over HTTPS
 *  - Field naming follows KRA camelCase/UPPER conventions commonly used
 *    in the OSCU sandbox (tin, bhfId, cmcKey, invcNo, rcptNo, etc.).
 */

/** Tax category code. KRA uses A/B/C/D/E for standard/zero/exempt/non-VAT/8%. */
export const KraTaxCategoryCode = z.enum(['A', 'B', 'C', 'D', 'E']);
export type KraTaxCategoryCode = z.infer<typeof KraTaxCategoryCode>;

/** Individual line item on an invoice submitted to OSCU. */
export const KraInvoiceItemSchema = z.object({
  /** Sequential item number on the invoice, 1-based */
  itemSeq: z.number().int().positive(),
  /** Internal SKU / product code */
  itemCd: z.string().min(1).max(20),
  /** KRA item classification code from queryItemClass */
  itemClsCd: z.string().min(1).max(20),
  /** Human-readable item name */
  itemNm: z.string().min(1).max(200),
  /** Packaging unit code (e.g. "NT" for number) */
  pkgUnitCd: z.string().default('NT'),
  /** Quantity unit code (e.g. "U" for each) */
  qtyUnitCd: z.string().default('U'),
  /** Quantity sold */
  qty: z.number().positive(),
  /** Unit price before tax */
  prc: z.number().nonnegative(),
  /** Line amount before discount = qty * prc */
  splyAmt: z.number().nonnegative(),
  /** Discount rate (0-100) */
  dcRt: z.number().min(0).max(100).default(0),
  /** Discount amount */
  dcAmt: z.number().nonnegative().default(0),
  /** Tax category: A=16% VAT, B=0%, C=exempt, D=non-VAT, E=8% */
  taxTyCd: KraTaxCategoryCode,
  /** Taxable amount after discount */
  taxblAmt: z.number().nonnegative(),
  /** VAT amount */
  taxAmt: z.number().nonnegative(),
  /** Total including tax */
  totAmt: z.number().nonnegative(),
});
export type KraInvoiceItem = z.infer<typeof KraInvoiceItemSchema>;

/** Input payload accepted by `submitInvoice`. */
export const KraInvoiceInputSchema = z.object({
  /** Client-generated trace number. Unique per device. */
  invcNo: z.number().int().positive(),
  /** Sale type: N=normal, C=copy, T=training, P=proforma */
  salesTyCd: z.enum(['N', 'C', 'T', 'P']).default('N'),
  /** Receipt type: S=sale, R=refund */
  rcptTyCd: z.enum(['S', 'R']).default('S'),
  /** Payment type code: 01=cash, 02=credit, 03=cash+credit, 04=bank, 05=mobile money */
  pmtTyCd: z.enum(['01', '02', '03', '04', '05']).default('05'),
  /** Sale status: 01=wait for approval, 02=approved, 05=cancelled */
  salesSttsCd: z.enum(['01', '02', '05']).default('02'),
  /** ISO-8601 date/time of sale */
  cfmDt: z.string(),
  /** Customer TIN (PIN). Optional for B2C. */
  custTin: z.string().optional(),
  /** Customer name */
  custNm: z.string().optional(),
  /** Total supply before tax */
  totTaxblAmt: z.number().nonnegative(),
  /** Total VAT amount */
  totTaxAmt: z.number().nonnegative(),
  /** Grand total */
  totAmt: z.number().nonnegative(),
  /** Invoice currency (ISO 4217). Defaults to KES. */
  currency: z.string().length(3).default('KES'),
  items: z.array(KraInvoiceItemSchema).min(1),
});
export type KraInvoiceInput = z.infer<typeof KraInvoiceInputSchema>;

/** Result returned from a successful OSCU invoice submission. */
export const KraInvoiceResultSchema = z.object({
  /** Client invoice trace number echoed back */
  invoiceNumber: z.string(),
  /** URL that encodes the QR code for the signed tax invoice */
  qrUrl: z.string().url(),
  /** KRA-side receipt signing timestamp */
  signedAt: z.string(),
  /** KRA-issued receipt number (rcptNo) */
  kraReceiptNo: z.string(),
  /** Internal data signature returned by eTIMS */
  internalData: z.string().optional(),
  /** Receipt signature returned by eTIMS */
  receiptSignature: z.string().optional(),
  /** Middleware message number */
  mrcNo: z.string().optional(),
});
export type KraInvoiceResult = z.infer<typeof KraInvoiceResultSchema>;

/** Raw envelope shape returned by eTIMS endpoints. */
export const KraEtimsEnvelopeSchema = z.object({
  resultCd: z.string(),
  resultMsg: z.string(),
  resultDt: z.string().optional(),
  data: z.unknown().optional(),
});
export type KraEtimsEnvelope = z.infer<typeof KraEtimsEnvelopeSchema>;

/** Item classification (KRA product/HS-like taxonomy) returned by queryItemClass. */
export const KraItemClassSchema = z.object({
  itemClsCd: z.string(),
  itemClsNm: z.string(),
  itemClsLvl: z.number().int(),
  taxTyCd: KraTaxCategoryCode.optional(),
  mjrTgYn: z.enum(['Y', 'N']).optional(),
  useYn: z.enum(['Y', 'N']).optional(),
});
export type KraItemClass = z.infer<typeof KraItemClassSchema>;

/** OSCU client configuration. */
export const KraEtimsConfigSchema = z.object({
  apiUrl: z.string().url(),
  /** Taxpayer PIN */
  tin: z.string().min(1),
  /** Branch office ID ("00" for HQ) */
  bhfId: z.string().min(1),
  /** Communication / signing key issued by KRA on device registration */
  cmcKey: z.string().min(1),
  /** Optional device serial / registration id */
  dvcSrlNo: z.string().optional(),
  /** HTTP request timeout in ms */
  timeoutMs: z.number().int().positive().default(15_000),
  /** Max retries on 5xx/network errors */
  maxRetries: z.number().int().nonnegative().default(3),
});
export type KraEtimsConfig = z.infer<typeof KraEtimsConfigSchema>;
