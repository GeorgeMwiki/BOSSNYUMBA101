/**
 * @bossnyumba/max-tool-use — shared types.
 *
 * Phase M-C primitives. Every module is provider-agnostic at the type
 * level — the Anthropic SDK is a peer dependency so the package can be
 * unit-tested without it. Concrete adapters live in each subdirectory.
 *
 * Convention: all interfaces are readonly; objects are never mutated.
 */

// ----------------------------------------------------------------------------
// Common primitives
// ----------------------------------------------------------------------------

/** A Claude model ID we expose through the M-C surface. */
export type ClaudeModelId =
  | 'claude-opus-4-7'
  | 'claude-opus-4-6'
  | 'claude-opus-4-5'
  | 'claude-sonnet-4-6'
  | 'claude-sonnet-4-5'
  | 'claude-haiku-4-5';

/** A canonical beta header. */
export type BetaHeader =
  | 'computer-use-2025-11-24'
  | 'files-api-2025-04-14'
  | 'mcp-client-2025-11-20'
  | 'code-execution-2025-08-25'
  | 'managed-agents-2026-04-01'
  | 'output-300k-2026-03-24'
  | 'interleaved-thinking-2025-05-14'
  | 'extended-cache-ttl-2025-04-11';

/** Identity of the calling tenant. Every M-C operation is scoped. */
export interface TenantContext {
  readonly tenantId: string;
  readonly principalId: string;
  readonly correlationId: string;
}

/** Cost telemetry emitted by every M-C driver. */
export interface CostTelemetry {
  readonly module:
    | 'ptc'
    | 'batch'
    | 'files-citations'
    | 'computer-use'
    | 'web-research'
    | 'memory'
    | 'mcp-connector'
    | 'cache-control';
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
  readonly cacheCreationTokens?: number;
  readonly toolDefinitionTokens?: number;
  readonly estimatedCostUsd: number;
  readonly model: ClaudeModelId;
  readonly correlationId: string;
  /** Free when paired with web_search or web_fetch. */
  readonly codeExecutionFreePaired?: boolean;
}

/** Standard outcome envelope for M-C calls. */
export type McResult<T> =
  | { readonly ok: true; readonly value: T; readonly telemetry: CostTelemetry }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
      readonly telemetry?: CostTelemetry;
    };

/** Anthropic-style tool definition (shape only, JSON-Schema-friendly). */
export interface DomainToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: {
    readonly type: 'object';
    readonly properties: Record<string, unknown>;
    readonly required?: ReadonlyArray<string>;
  };
}

/** The signature a domain MCP server exposes back into PTC. */
export interface DomainToolHandler {
  readonly name: string;
  invoke(input: unknown, ctx: TenantContext): Promise<unknown>;
}

// ----------------------------------------------------------------------------
// PTC types (re-exported via module index)
// ----------------------------------------------------------------------------

export interface PtcRequest {
  readonly task: string;
  readonly tools: ReadonlyArray<DomainToolHandler>;
  readonly toolDefs?: ReadonlyArray<DomainToolDefinition>;
  readonly model: ClaudeModelId;
  readonly ctx: TenantContext;
  readonly maxIterations?: number;
  /** Optional override for the synthetic Python emitter (test-only). */
  readonly pythonEmitter?: (task: string, tools: ReadonlyArray<string>) => string;
}

export interface PtcResult {
  readonly answer: string;
  readonly stepsExecuted: number;
  readonly roundTripsSaved: number;
  readonly pythonProgram: string;
  readonly toolCalls: ReadonlyArray<{
    readonly tool: string;
    readonly input: unknown;
    readonly output: unknown;
    readonly durationMs: number;
  }>;
}

// ----------------------------------------------------------------------------
// Batch API types
// ----------------------------------------------------------------------------

export interface BatchRequest {
  readonly customId: string;
  readonly model: ClaudeModelId;
  readonly messages: ReadonlyArray<{
    readonly role: 'user' | 'assistant';
    readonly content: string;
  }>;
  readonly maxTokens: number;
  readonly cacheControl?: { readonly ttlSeconds: 300 | 3600 };
}

export interface BatchHandle {
  readonly batchId: string;
  readonly status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  readonly submittedAt: string;
  readonly requestCount: number;
  readonly model: ClaudeModelId;
}

export interface BatchResult {
  readonly batchId: string;
  readonly results: ReadonlyArray<{
    readonly customId: string;
    readonly success: boolean;
    readonly content?: string;
    readonly errorMessage?: string;
  }>;
  readonly completedAt: string;
  readonly latencyMs: number;
  /** Stacked discount actually achieved. */
  readonly effectiveDiscount: number;
}

// ----------------------------------------------------------------------------
// Files + Citations types
// ----------------------------------------------------------------------------

export type SupportedFileMime =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'text/csv'
  | 'text/markdown'
  | 'application/json'
  | 'application/rtf'
  | 'text/html'
  | 'application/epub+zip'
  | 'application/vnd.oasis.opendocument.text';

export interface FileUploadRequest {
  readonly path: string;
  readonly mime: SupportedFileMime;
  readonly title?: string;
  readonly tenantContext: TenantContext;
}

export interface FileId {
  readonly value: string;
}

export interface CitationLocation {
  readonly fileId: FileId;
  readonly title: string;
  readonly type: 'page_location' | 'char_location' | 'content_block_location';
  readonly start: number;
  readonly end: number;
  readonly citedText: string;
}

export interface CitedAnswer {
  readonly answer: string;
  readonly citations: ReadonlyArray<CitationLocation>;
  /** cited_text is free in Anthropic's pricing. */
  readonly citedTokenFreeBytes: number;
}

// ----------------------------------------------------------------------------
// Computer Use types
// ----------------------------------------------------------------------------

export type ComputerUseAction =
  | 'screenshot'
  | 'left_click'
  | 'type'
  | 'key'
  | 'scroll'
  | 'zoom'
  | 'wait';

export interface ComputerUseRequest {
  readonly task: string;
  readonly allowedDomains: ReadonlyArray<string>;
  readonly allowedActions: ReadonlyArray<ComputerUseAction>;
  readonly tenantContext: TenantContext;
  readonly displayWidthPx?: number;
  readonly displayHeightPx?: number;
  readonly enableZoom?: boolean;
  /** Always true for M-C — never run in parent context. */
  readonly subagentIsolation?: boolean;
}

export interface ComputerUseResult {
  readonly task: string;
  readonly actionsTaken: ReadonlyArray<{
    readonly action: ComputerUseAction;
    readonly target?: string;
    readonly ok: boolean;
  }>;
  readonly outcome: 'completed' | 'rejected' | 'classifier_intervention';
  readonly classifierFlags: ReadonlyArray<string>;
}

// ----------------------------------------------------------------------------
// Web Research composition types
// ----------------------------------------------------------------------------

export interface ComposedResearchRequest {
  readonly question: string;
  readonly sources?: ReadonlyArray<string>;
  readonly freshness?: 'past_day' | 'past_week' | 'past_month' | 'any';
  readonly maxUrls?: number;
  readonly tenantContext: TenantContext;
  readonly model?: ClaudeModelId;
}

export interface ComposedResearchResult {
  readonly question: string;
  readonly answer: string;
  readonly urlsConsulted: ReadonlyArray<{
    readonly url: string;
    readonly title: string;
    readonly excerpt: string;
  }>;
  readonly extractedFacts: ReadonlyArray<{
    readonly fact: string;
    readonly sourceUrl: string;
  }>;
  /** Code execution stays FREE while paired with web tools. */
  readonly codeExecutionPaired: boolean;
  readonly estimatedCostUsd: number;
}

// ----------------------------------------------------------------------------
// Memory tool types
// ----------------------------------------------------------------------------

export type MemoryBackend = 'managed-agents' | 'sessionstore';

export interface MemoryAdapter {
  readonly backend: MemoryBackend;
  view(tenantId: string, path: string): Promise<string | null>;
  create(tenantId: string, path: string, content: string): Promise<void>;
  strReplace(
    tenantId: string,
    path: string,
    oldStr: string,
    newStr: string,
  ): Promise<void>;
  insert(tenantId: string, path: string, line: number, content: string): Promise<void>;
  delete(tenantId: string, path: string): Promise<void>;
  rename(tenantId: string, fromPath: string, toPath: string): Promise<void>;
  list(tenantId: string, dirPath: string): Promise<ReadonlyArray<string>>;
}

// ----------------------------------------------------------------------------
// MCP Connector types
// ----------------------------------------------------------------------------

export type ConnectorProvider = 'pesapal' | 'mpesa-daraja' | 'nls' | 'kra-itax';

export interface McpConnectorConfig {
  readonly provider: ConnectorProvider;
  readonly url: string;
  readonly authorization: string;
  readonly toolFilter?: ReadonlyArray<string>;
  readonly fallbackUrl?: string;
}

export interface ConnectorHealthProbe {
  readonly provider: ConnectorProvider;
  readonly ok: boolean;
  readonly latencyMs: number;
  readonly viaFallback: boolean;
  readonly errorMessage?: string;
}

// ----------------------------------------------------------------------------
// Cache control types
// ----------------------------------------------------------------------------

export interface CacheControlBlock {
  readonly type: 'ephemeral';
  readonly ttl_seconds: 300 | 3600;
}

export interface CachedPrefixSegment {
  readonly content: string;
  readonly cache_control: CacheControlBlock;
}

export interface CacheUtilizationTelemetry {
  readonly correlationId: string;
  readonly ttlSeconds: 300 | 3600;
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
  readonly hitRate: number;
  readonly would5MinHaveEvicted: boolean;
  readonly model: ClaudeModelId;
}
