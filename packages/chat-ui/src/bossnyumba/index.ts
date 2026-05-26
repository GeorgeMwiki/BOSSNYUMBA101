/**
 * BossNyumba chat-ui surface — locale-aware SSE chat hook with
 * retranslation against /api/v1/translate. Mounted alongside the
 * existing useChatStream / useJarvis hooks for cases where consumers
 * need the bilingual cache + per-message retranslation pattern.
 */
export {
  useBossNyumbaChat,
  type BossNyumbaMode,
  type BossNyumbaLanguage,
  type BossNyumbaRole,
  type BossNyumbaJuniorCall,
  type BossNyumbaChatMessage,
  type BossNyumbaMessage,
  type BossNyumbaSendOptions,
  type UseBossNyumbaChatOptions,
  type UseBossNyumbaChatResult,
} from './useBossNyumbaChat.js';
