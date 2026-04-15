/**
 * Adapter registry.
 *
 * Central export point so the worker can pull every adapter with one import.
 * Order here is informational only - the worker runs them sequentially to
 * keep database load predictable.
 */

export type { RetentionAdapter, AdapterResult, AdapterRunOptions } from './types.js';
export { createAuditEventsAdapter } from './audit-events.adapter.js';
export { createChatMessagesAdapter } from './chat-messages.adapter.js';
export { createCommunicationLogsAdapter } from './communication-logs.adapter.js';
export { createAiInteractionsAdapter } from './ai-interactions.adapter.js';
export { createDeletedUserPiiAdapter } from './deleted-user-pii.adapter.js';
