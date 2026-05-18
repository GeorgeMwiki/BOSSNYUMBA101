/**
 * @bossnyumba/mcp-server-nin — shared types.
 *
 * MCP tool surface that lets the kernel verify a Nigerian NIN against
 * the NIMC NIVS (National Identity Verification Service) API. The
 * production adapter lands in Phase F; this scaffold ships the tool
 * descriptors + a deterministic mock for tests + the MCP-server entry
 * so cross-service composition wiring can be exercised today.
 */

// ---------------------------------------------------------------------------
// JSON-Schema (minimal subset for tool descriptors)
// ---------------------------------------------------------------------------

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
// Adapter contract — NotYetWired for Phase E.5.4
// ---------------------------------------------------------------------------

export interface NinAdapter {
  /**
   * Verify a Nigerian NIN against NIMC NIVS. Production implementation
   * lives in Phase F (see https://nimc.gov.ng/the-nivs-platform/).
   * The Phase E.5.4 scaffold ships a deterministic mock keyed on the
   * NIN itself so tests can assert tool wiring without network IO.
   */
  verifyNin(args: VerifyNinArgs): Promise<VerifyNinResult>;
}

export interface VerifyNinArgs {
  readonly nin: string;
  /** Biometric fingerprint hash (SHA-256). Optional in scaffold. */
  readonly biometricHash?: string;
  readonly tenantId: string;
}

export interface VerifyNinResult {
  readonly verified: boolean;
  /** NIMC reference for the verification call. */
  readonly referenceId: string;
  readonly matchScore: number;
  readonly reason?: string;
}

export interface ToolDeps {
  readonly nin: NinAdapter;
}

// ---------------------------------------------------------------------------
// Tool descriptor — MCP advertises + executes
// ---------------------------------------------------------------------------

export interface NinTool<O = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchemaObject;
  readonly outputSchema: JsonSchemaObject;
  readonly execute: (input: unknown, deps: ToolDeps) => Promise<O>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class NinAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'NinAdapterError';
  }
}
