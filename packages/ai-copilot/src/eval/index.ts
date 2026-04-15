/**
 * Eval harness — golden scenarios + runner.
 *
 * NOT a vitest test. Callers that want CI integration wrap
 * `runScenarios(GOLDEN_SCENARIOS, ...)` in a vitest test and assert
 * `report.failed === 0`.
 */

export * from './scenario.js';
export * from './golden-scenarios.js';
export * from './runner.js';
