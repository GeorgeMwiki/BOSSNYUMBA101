/**
 * Coworker training feature — scenario simulation (gap 9) + mastery checkpoint
 * (gap 10). Public surface for the /coworker/training/* pages.
 */

export { ScenarioBrowser } from './ScenarioBrowser';
export { ScenarioWorkspace } from './ScenarioWorkspace';
export { MasteryCheckpoint } from './MasteryCheckpoint';
export { TrainingNav } from './TrainingNav';
export {
  TrainingProvider,
  useTraining,
  type TrainingState,
  type TrainingContextValue,
  type TranscriptTurn,
} from './training-mode-context';
export {
  toTrainingLanguage,
  formatElapsed,
  computeRunScore,
  difficultyTone,
  kindLabelKey,
  roleModeLabelKey,
  SCENARIO_KINDS,
  SCENARIO_DIFFICULTIES,
  ROLE_MODES,
  type TrainingLanguage,
  type ScenarioKind,
  type ScenarioDifficulty,
  type RoleModeValue,
} from './training-language';
