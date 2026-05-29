/**
 * BossNyumba SSE inline-tags barrel.
 *
 * Public XML-like tag protocols Mr. Mwikila streams inline with chat
 * text. The gateway parses them out of the SSE stream and routes the
 * structured payloads to the appropriate FE consumer.
 */

export {
  // Schemas
  tabTagsTypeSchema,
  tabSpawnSchema,
  tabUpdateSchema,
  tabRemoveSchema,
  tabProposalSchema,
  tabTagSchema,
  // Types
  type TabSpawnTag,
  type TabUpdateTag,
  type TabRemoveTag,
  type TabProposalTag,
  type TabTag,
  type ExtractTabTagsResult,
  // Functions
  extractTabTags,
  isTabSpawn,
  isTabUpdate,
  isTabRemove,
  isTabProposal,
  pickTagTitle,
  pickProposalReason,
} from './tab-tags.js';
