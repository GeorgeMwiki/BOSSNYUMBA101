/**
 * @bossnyumba/mcp-server-nggis — shared types.
 *
 * Land-registry MCP server for Nigeria. Title deeds in Nigeria are
 * administered per-state (LASRRA in Lagos, ABGIS in the FCT, KADGIS
 * in Kaduna, etc.); the National Geospatial Information System
 * (NGGIS) provides a federal-aggregator interface. This MCP server
 * fans out to whichever state registry the property sits in and
 * normalises the response shape.
 *
 * Phase E.5.4 ships a deterministic mock; Phase F wires the real
 * state-by-state REST clients behind a discriminated-union adapter.
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

export interface NggisAdapter {
  verifyTitleDeed(args: VerifyTitleDeedArgs): Promise<VerifyTitleDeedResult>;
  searchProperty(args: SearchPropertyArgs): Promise<SearchPropertyResult>;
}

export interface VerifyTitleDeedArgs {
  readonly tenantId: string;
  readonly deedNumber: string;
  /** 2-letter Nigerian state code (LA = Lagos, FC = FCT/Abuja, KD = Kaduna…) */
  readonly stateCode: string;
}

export interface VerifyTitleDeedResult {
  readonly verified: boolean;
  readonly registry: string;
  readonly currentOwner?: string;
  readonly registeredAt?: string;
  readonly encumbrances?: ReadonlyArray<string>;
  readonly reason?: string;
}

export interface SearchPropertyArgs {
  readonly tenantId: string;
  readonly stateCode: string;
  readonly query: string;
  /** Optional limit; default 10. */
  readonly limit?: number;
}

export interface PropertyMatch {
  readonly deedNumber: string;
  readonly address: string;
  readonly registry: string;
  readonly status: 'active' | 'lapsed' | 'disputed';
}

export interface SearchPropertyResult {
  readonly matches: ReadonlyArray<PropertyMatch>;
}

export interface ToolDeps {
  readonly nggis: NggisAdapter;
}

export interface NggisTool<O = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchemaObject;
  readonly outputSchema: JsonSchemaObject;
  readonly execute: (input: unknown, deps: ToolDeps) => Promise<O>;
}

export class NggisAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'NggisAdapterError';
  }
}
