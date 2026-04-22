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
