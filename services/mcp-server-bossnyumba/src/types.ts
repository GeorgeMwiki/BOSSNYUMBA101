/**
 * BossNyumba public MCP server — shared types.
 *
 * The public MCP surface differs from the internal `@bossnyumba/mcp-server`
 * (BossNyumba-era property tooling) in three ways:
 *   1. Auth is OAuth2 device flow, not API key.
 *   2. Scopes are BossNyumba-property-domain shaped (`owner:read`,
 *      `owner:write`, `owner:draft`, `owner:reminders`, `owner:share`,
 *      `admin:read`).
 *   3. Tool descriptors are sourced from the api-gateway brain-tools
 *      catalog at boot — no parallel registry.
 *
 * Tenant isolation: every tool call carries the agent's auth context
 * which holds the tenantId resolved from the access-token row. The
 * gateway middleware binds `app.current_tenant_id` GUC before any
 * downstream database call. The MCP layer never reaches across tenants.
 */

export type BossNyumbaScope =
  | 'owner:read'
  | 'owner:write'
  | 'owner:draft'
  | 'owner:reminders'
  | 'owner:share'
  | 'admin:read';

export const BOSSNYUMBA_SCOPES: ReadonlyArray<BossNyumbaScope> = Object.freeze([
  'owner:read',
  'owner:write',
  'owner:draft',
  'owner:reminders',
  'owner:share',
  'admin:read',
]);

export interface BossNyumbaMcpAuthContext {
  readonly tenantId: string;
  readonly ownerId: string;
  readonly agentName: string;
  readonly agentTokenId: string;
  readonly scopes: ReadonlyArray<BossNyumbaScope>;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly correlationId: string;
}

/**
 * A tool descriptor for the public MCP server. Mirrors the brain-tools
 * descriptor shape but flattens the zod schema to JSON Schema so MCP
 * clients (which do not know about zod) can render it.
 */
export interface BossNyumbaMcpToolDescriptor {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: BossNyumbaMcpJsonSchema;
  readonly requiredScopes: ReadonlyArray<BossNyumbaScope>;
  readonly stakes: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly isWrite: boolean;
  readonly requiresConfirmation: boolean;
}

export interface BossNyumbaMcpJsonSchema {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, BossNyumbaMcpJsonProperty>>;
  readonly required: ReadonlyArray<string>;
}

export interface BossNyumbaMcpJsonProperty {
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly description?: string;
  readonly enum?: ReadonlyArray<string>;
  readonly items?: BossNyumbaMcpJsonProperty;
  readonly format?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Resources — what an external MCP client can read as side-data
// ─────────────────────────────────────────────────────────────────────

export interface BossNyumbaMcpResource {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
}

export interface BossNyumbaMcpResourceContent {
  readonly uri: string;
  readonly mimeType: string;
  readonly text?: string;
  readonly base64?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Prompts — pre-canned prompt templates exposed via prompts/list
// ─────────────────────────────────────────────────────────────────────

export interface BossNyumbaMcpPrompt {
  readonly name: string;
  readonly description: string;
  readonly arguments: ReadonlyArray<BossNyumbaMcpPromptArgument>;
}

export interface BossNyumbaMcpPromptArgument {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
}

export interface BossNyumbaMcpPromptMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: { readonly type: 'text'; readonly text: string };
}

// ─────────────────────────────────────────────────────────────────────
// Tool invocation — the response shape mirrors the home-chat envelope
// so external agents render the same blocks the owner sees.
// ─────────────────────────────────────────────────────────────────────

export interface BossNyumbaMcpToolSuccess {
  readonly ok: true;
  readonly content: ReadonlyArray<BossNyumbaMcpToolContentBlock>;
  readonly confidence: number;
  readonly evidenceIds: ReadonlyArray<string>;
  readonly provenance: BossNyumbaMcpProvenance;
  readonly requiresConfirmation: boolean;
}

export interface BossNyumbaMcpToolFailure {
  readonly ok: false;
  readonly errorCode: string;
  readonly message: string;
  readonly correlationId: string;
}

export type BossNyumbaMcpToolResult = BossNyumbaMcpToolSuccess | BossNyumbaMcpToolFailure;

export interface BossNyumbaMcpToolContentBlock {
  readonly type: 'text' | 'json' | 'card' | 'media' | 'draft';
  readonly text?: string;
  readonly data?: unknown;
}

export interface BossNyumbaMcpProvenance {
  readonly via: 'mcp';
  readonly agentName: string;
  readonly agentTokenId: string;
  readonly toolName: string;
  readonly invokedAt: string;
  readonly auditChainHash: string;
}
