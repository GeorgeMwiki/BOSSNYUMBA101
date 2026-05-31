export { Blackboard } from './Blackboard';

// 9 board-primitives + parser — ported from Borjie for BossNyumba.
export {
  BOARD_ELEMENT_TYPES,
  boardElementSchema,
  bilingualSchema,
  type BoardElement,
  type BoardElementType,
  type BoardElementEnvelope,
  type Bilingual,
  type FormulaBoardElement,
  type DiagramBoardElement,
  type ChartBoardElement,
  type ComparisonBoardElement,
  type ImageBoardElement,
  type TextBoardElement,
  type HighlightBoardElement,
  type ArrowBoardElement,
  type SketchBoardElement,
} from './board-element-types.js';
export {
  parseBoardElements,
  type ParseBoardElementsResult,
} from './parse-board-elements.js';
