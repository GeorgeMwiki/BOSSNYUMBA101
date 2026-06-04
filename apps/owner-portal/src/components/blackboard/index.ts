/**
 * BossNyumba blackboard — public surface (owner-portal local).
 *
 * Other modules import only from this index so the internal layout
 * stays free to evolve.
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
