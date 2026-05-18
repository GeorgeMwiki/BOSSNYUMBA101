/**
 * @bossnyumba/mcp-server-opay — shared types.
 *
 * OPay is Nigeria's largest mobile-money operator (~40 % daily-active
 * share per CBN Q1-2026 returns). This MCP server wraps the OPay
 * Merchant API behind 3 MCP tools that mirror the Daraja (M-Pesa
 * Kenya) tool grammar so the kernel can stay rail-agnostic.
 *
 * Phase E.5.4 ships a deterministic mock; Phase F wires the real
 * OPay Merchant API (OAuth2 + HMAC-signed requests).
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

export interface OpayAdapter {
  initiatePayment(args: InitiatePaymentArgs): Promise<InitiatePaymentResult>;
  verifyPayment(args: VerifyPaymentArgs): Promise<VerifyPaymentResult>;
  cashflowLookup(args: CashflowLookupArgs): Promise<CashflowLookupResult>;
}

export interface InitiatePaymentArgs {
  readonly tenantId: string;
  /** Payer wallet identifier (Nigerian phone in E.164). */
  readonly payerPhone: string;
  /** Amount in NGN minor units (kobo). */
  readonly amountKobo: number;
  readonly reference: string;
  readonly narration?: string;
}

export interface InitiatePaymentResult {
  readonly transactionId: string;
  readonly status: 'pending' | 'succeeded' | 'failed';
  readonly reason?: string;
}

export interface VerifyPaymentArgs {
  readonly tenantId: string;
  readonly transactionId: string;
}

export interface VerifyPaymentResult {
  readonly status: 'pending' | 'succeeded' | 'failed' | 'reversed';
  readonly amountKobo: number;
  readonly settledAt?: string;
}

export interface CashflowLookupArgs {
  readonly tenantId: string;
  /** Wallet phone in E.164 (Nigeria). */
  readonly payerPhone: string;
  readonly fromDate: string; // YYYY-MM-DD
  readonly toDate: string;
}

export interface CashflowSample {
  readonly date: string;
  readonly inflowsKobo: number;
  readonly outflowsKobo: number;
}

export interface CashflowLookupResult {
  readonly samples: ReadonlyArray<CashflowSample>;
  readonly totalInflowsKobo: number;
  readonly totalOutflowsKobo: number;
}

export interface ToolDeps {
  readonly opay: OpayAdapter;
}

export interface OpayTool<O = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchemaObject;
  readonly outputSchema: JsonSchemaObject;
  readonly execute: (input: unknown, deps: ToolDeps) => Promise<O>;
}

export class OpayAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'OpayAdapterError';
  }
}
