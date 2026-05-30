/**
 * BossNyumba blackboard — public surface (owner-portal local).
 *
 * Mirrors Borjie's owner-web blackboard so the chat ↔ board hook
 * lives in the same shape across repos. Other modules import only
 * from this index to keep the internal layout free to evolve.
 */

export { Blackboard } from './Blackboard';
export { BoardElementRenderer } from './board-element-renderer';
export {
  appendBoardElement,
  clearBoard,
  endReplay,
  focusBoardElement,
  getBoardState,
  removeBoardElement,
  startReplay,
  useBlackboardStore,
} from './use-blackboard-store';
export { useChatBoardBridge } from './use-chat-board-bridge';
