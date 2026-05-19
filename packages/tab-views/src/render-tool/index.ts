/**
 * @bossnyumba/tab-views/render-tool — the LLM-facing tool that
 * turns a tab into ag-ui blocks rendered inline in chat.
 */

export {
  renderTabInChat,
  type RenderTabContext,
  type RenderTabDeps,
} from './render-tab-in-chat.js';

export type {
  RenderTabRequest,
  RenderTabResult,
  RenderTabSuccess,
  RenderTabFailure,
  RenderTabError,
  RenderAuditEntry,
} from './types.js';

export {
  createNoopDataPort,
  createMemoisedDataPort,
  type DataPort,
  type DataFetchOptions,
  type DataFetchResult,
} from './data-port.js';

export {
  createInMemoryAuditSink,
  nextAuditId,
  type AuditSink,
  type InMemoryAuditSink,
} from './audit-sink.js';

export {
  describeRenderTabInChatTool,
  type ToolDescriptor,
} from './tool-descriptor.js';
