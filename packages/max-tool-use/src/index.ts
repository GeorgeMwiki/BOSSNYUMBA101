/**
 * @bossnyumba/max-tool-use — public surface.
 *
 * Phase M-C — Maximum Tool-Use Capabilities. Closes L2 top-10:
 *
 *   1. Programmatic Tool Calling (`code_execution_20260120`)
 *   2. Message Batches API (50% off; stacks with caching to 95%)
 *   3. Files API + Citations API
 *   4. Extended thinking with interleaved tools (M-A; surfaced here)
 *   5. Computer Use (`computer_20251124`)
 *   6. Web Search + Web Fetch + Code Exec composition (code exec FREE)
 *   7. Memory tool + Managed Agents `/mnt/memory/`
 *   8. MCP Connector mode
 *   9. Prompt caching with explicit 1h TTL opt-in
 *  10. Agent Skills filesystem-load (continuation from K-C)
 *
 * All modules are independently importable via sub-path exports — see
 * `package.json` `exports` for the canonical list.
 */

// Shared types
export type {
  ClaudeModelId,
  BetaHeader,
  TenantContext,
  CostTelemetry,
  McResult,
  DomainToolDefinition,
  DomainToolHandler,
  PtcRequest,
  PtcResult,
  BatchRequest,
  BatchHandle,
  BatchResult,
  SupportedFileMime,
  FileUploadRequest,
  FileId,
  CitationLocation,
  CitedAnswer,
  ComputerUseAction,
  ComputerUseRequest,
  ComputerUseResult,
  ComposedResearchRequest,
  ComposedResearchResult,
  MemoryBackend,
  MemoryAdapter,
  ConnectorProvider,
  McpConnectorConfig,
  ConnectorHealthProbe,
  CacheControlBlock,
  CachedPrefixSegment,
  CacheUtilizationTelemetry,
} from './types.js';

// Module re-exports
export * as ptc from './programmatic-tool-calling/index.js';
export * as batchApi from './batch-api/index.js';
export * as filesCitations from './files-citations/index.js';
export * as computerUse from './computer-use/index.js';
export * as webResearch from './web-research/index.js';
export * as memory from './memory-tool/index.js';
export * as mcpConnectors from './mcp-connectors/index.js';
export * as cacheControl from './cache-control/index.js';

// Convenience top-level entrypoints
export { runPTCSession } from './programmatic-tool-calling/index.js';
export { submitBatch, pollBatch } from './batch-api/index.js';
export { uploadFile, analyzeWithCitations } from './files-citations/index.js';
export { runComputerUseSession } from './computer-use/index.js';
export { composedResearch } from './web-research/index.js';
export { createMemoryAdapter } from './memory-tool/index.js';
export {
  createConnectorRegistry,
  createHealthProber,
} from './mcp-connectors/index.js';
export {
  wrapStablePrefix,
  wrapStablePrefixes,
  betasForCacheTtl,
  summariseCacheUtilization,
  ONE_HOUR_OPT_IN_SNIPPET,
  DEFAULT_TTL_SECONDS,
} from './cache-control/index.js';
