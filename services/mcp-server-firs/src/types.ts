/**
 * @bossnyumba/mcp-server-firs — shared types.
 *
 * Wraps the Federal Inland Revenue Service / Nigeria Revenue Service
 * tax surface behind 3 MCP tools (file_vat_return, verify_tin,
 * get_payment_status). Production adapter (TaxProMax + NRS Tax ID
 * Portal) ships in Phase F; this scaffold provides deterministic
 * mocks keyed on input shape.
 */

export interface JsonSchemaProperty {
  readonly type: string;
  readonly description?: string;
  readonly format?: string;
  readonly enum?: ReadonlyArray<string | number>;
  readonly items?: unknown;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: ReadonlyArray<string>;
  readonly additionalProperties?: boolean | unknown;
  readonly minimum?: number;
  readonly maximum?: number;
}

export interface JsonSchemaObject {
  readonly type: string;
  readonly properties: Readonly<Record<string, JsonSchemaProperty>>;
  readonly required?: ReadonlyArray<string>;
  readonly additionalProperties?: boolean;
}

// ---------------------------------------------------------------------------
// Adapter contract
// ---------------------------------------------------------------------------

export interface FirsAdapter {
  fileVatReturn(args: FileVatReturnArgs): Promise<FileVatReturnResult>;
  verifyTin(args: VerifyTinArgs): Promise<VerifyTinResult>;
  getPaymentStatus(args: GetPaymentStatusArgs): Promise<GetPaymentStatusResult>;
}

export interface FileVatReturnArgs {
  readonly tenantId: string;
  readonly tin: string;
  readonly period: string; // YYYY-MM
  /** Total VAT-exclusive taxable sales (NGN minor units / kobo). */
  readonly grossSalesKobo: number;
  /** Total input-VAT credit (NGN minor units / kobo). */
  readonly inputVatKobo: number;
}

export interface FileVatReturnResult {
  readonly acknowledgementId: string;
  readonly outputVatKobo: number;
  readonly netPayableKobo: number;
  readonly filingStatus: 'accepted' | 'pending' | 'rejected';
}

export interface VerifyTinArgs {
  readonly tenantId: string;
  readonly tin: string;
}

export interface VerifyTinResult {
  readonly verified: boolean;
  /** 'firs' for legacy 12-digit TIN; 'nrs' for the 2026+ 13-digit Tax ID. */
  readonly issuer: 'firs' | 'nrs' | 'unknown';
  readonly taxpayerName?: string;
  readonly reason?: string;
}

export interface GetPaymentStatusArgs {
  readonly tenantId: string;
  readonly acknowledgementId: string;
}

export interface GetPaymentStatusResult {
  readonly status: 'unpaid' | 'paid' | 'partial' | 'overdue';
  readonly balanceKobo: number;
  readonly lastUpdated: string;
}

export interface ToolDeps {
  readonly firs: FirsAdapter;
}

// ---------------------------------------------------------------------------
// Tool descriptor
// ---------------------------------------------------------------------------

export interface FirsTool<O = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchemaObject;
  readonly outputSchema: JsonSchemaObject;
  readonly execute: (input: unknown, deps: ToolDeps) => Promise<O>;
}

export class FirsAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'FirsAdapterError';
  }
}
