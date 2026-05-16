/**
 * @bossnyumba/central-intelligence — public surface.
 *
 * The embodied-agent layer. The organization and the industry speak
 * in first person, grounded in their own knowledge graphs, with
 * tool-using extended-thinking agency.
 *
 * Typical composition:
 *
 *   const agent = createCentralIntelligenceAgent({
 *     llm,                      // Claude / Anthropic adapter
 *     tools: createToolRegistry([
 *       makeGraphQueryTool(graphService),
 *       makeForecastTool(forecaster),
 *       makeAuditLookupTool(audit),
 *       makePlatformAggregateTool(dpAggregator),
 *       makeDocsSearchTool(vectorStore),
 *     ]),
 *     memory,                   // pgvector-backed memory in prod
 *     voice: createDefaultVoiceResolver(),
 *   });
 *
 *   for await (const event of agent.run({ threadId, userMessage, ctx })) {
 *     stream.write(event);      // SSE to client
 *   }
 */

export * from './types.js';
export {
  createCentralIntelligenceAgent,
  type AgentLoopDeps,
  type VoiceResolver,
} from './agent/agent-loop.js';
export { createToolRegistry } from './tools/registry.js';
export { createInMemoryConversationMemory } from './memory/in-memory-memory.js';
export {
  createDefaultVoiceResolver,
  createInMemoryVoicePersonaSource,
  DEFAULT_TENANT_BINDING,
  DEFAULT_PLATFORM_BINDING,
  type VoicePersonaSource,
} from './voice/resolver.js';
export {
  createConversationAuditRecorder,
  summariseToolCall,
  PLATFORM_AUDIT_TENANT_ID,
  type AuditSink,
  type AuditSinkInput,
  type ConversationAuditEvent,
  type ConversationAuditRecorder,
  type ConversationAuditRecorderDeps,
  type UserMessageEvent,
  type ToolCallAuditSummary,
  type AuditKnownTool,
} from './audit/conversation-audit.js';
export {
  createInMemoryAuditSinkAndReader,
  type ConversationAuditReader,
  type ConversationAuditRecord,
} from './audit/conversation-audit-reader.js';

// Kernel — disciplined cognitive layer above the streaming agent loop.
// See kernel/index.ts for the full surface; mirrors LITFIN's brain-
// kernel patterns scoped to property management. Flat-exported so
// consumers can `import { composeSovereign, createAnthropicSensor,
// SOVEREIGN_ADMIN_PERSONA } from '@bossnyumba/central-intelligence'`
// without a namespace hop.
export * from './kernel/index.js';

// Namespace exports (`agency`, `counterModel`) must be re-exported
// explicitly — `export * from` does NOT carry over `export * as <ns>`
// declarations.
export {
  agency,
  counterModel,
} from './kernel/index.js';
