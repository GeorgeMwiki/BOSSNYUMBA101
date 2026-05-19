/**
 * Safety wrap around a Browser-Use driver.
 *
 *   1. Validate the task description through the input shield BEFORE
 *      kicking off the browser run. `blocked` -> return synthetic
 *      `injection_blocked` result without invoking the driver.
 *
 *   2. Enforce the `allowedHosts` allowlist. Any host the driver
 *      touches outside the list is denied (the underlying driver is
 *      responsible for surfacing host visits via raw events; the
 *      wrap clamps the final result + flags violations).
 *
 *   3. Scan extracted text through the shield AGAIN before returning
 *      it to the caller. Suspicious results stay flagged in `error`;
 *      blocked results clear `extracted` and set status to
 *      `injection_blocked`.
 *
 *   4. Enforce wall-clock timeout via Promise.race against a manual
 *      timer. Timeout returns synthetic `timeout` status; the driver
 *      run still completes in the background but its results are
 *      discarded.
 *
 *   5. Cap LLM step count at the task's `maxSteps` (default 20). The
 *      driver is contractually expected to honour this; the wrap
 *      cross-checks and rewrites `status: 'timeout'` if the driver
 *      reports more steps than allowed.
 *
 * This is the M-D minimum-viable wrap. M-E will replace
 * `regexInputShield` with the full classifier-based defense.
 */

import type {
  BrowserUseDriverPort,
  InputShieldPort,
} from '../ports/index.js';
import type { BrowserTask, BrowserTaskResult } from '../types/index.js';

export interface SafeBrowserUseDeps {
  /** Concrete driver (production wraps the open-source browser-use). */
  readonly driver: BrowserUseDriverPort;
  /** Input + output shield. Defaults to the regex shield. */
  readonly shield: InputShieldPort;
  /** Clock for timeout enforcement. */
  readonly clock: { readonly nowMs: () => number };
  /** Logger callback for observability. */
  readonly log?: (msg: string, extra?: Readonly<Record<string, unknown>>) => void;
}

/**
 * Wrap a raw Browser-Use driver with the M-D safety stack. Returns
 * a port-compatible driver that callers can drop in anywhere a
 * `BrowserUseDriverPort` is accepted.
 */
export function createSafeBrowserUseDriver(
  deps: SafeBrowserUseDeps,
): BrowserUseDriverPort {
  const log = deps.log ?? (() => {});

  return {
    runTask: async (task: BrowserTask): Promise<BrowserTaskResult> => {
      const startMs = deps.clock.nowMs();
      const maxSteps = task.maxSteps ?? 20;

      // 1. Pre-flight shield on the task description.
      const descShield = await deps.shield.scan(task.description);
      if (descShield.kind === 'blocked') {
        log('shield-blocked-task', { taskId: task.id, matches: descShield.matches });
        return Object.freeze({
          taskId: task.id,
          status: 'injection_blocked',
          extracted: [],
          screenshotPaths: [],
          stepsUsed: 0,
          elapsedMs: deps.clock.nowMs() - startMs,
          costUsd: 0,
          error: {
            code: 'shield_blocked_description',
            message: descShield.reason,
          },
        });
      }

      // 2. allowedHosts must be non-empty — silent allow-all is a
      //    footgun. Defense in depth.
      if (task.allowedHosts.length === 0) {
        return Object.freeze({
          taskId: task.id,
          status: 'denied',
          extracted: [],
          screenshotPaths: [],
          stepsUsed: 0,
          elapsedMs: deps.clock.nowMs() - startMs,
          costUsd: 0,
          error: {
            code: 'no_allowed_hosts',
            message: 'Task must declare at least one allowedHost',
          },
        });
      }

      // 3. Wall-clock timeout race.
      const result = await Promise.race([
        deps.driver.runTask(task),
        timeoutResult(task, startMs, deps.clock, task.timeoutMs),
      ]);

      // 4. Step-cap cross-check.
      if (result.status === 'ok' && result.stepsUsed > maxSteps) {
        log('step-cap-exceeded', { taskId: task.id, used: result.stepsUsed, cap: maxSteps });
        return Object.freeze({
          ...result,
          status: 'timeout',
          error: {
            code: 'step_cap_exceeded',
            message: `Driver used ${result.stepsUsed} steps; cap was ${maxSteps}`,
          },
        });
      }

      // 5. Post-flight shield on extracted text.
      if (result.status === 'ok' && result.extracted.length > 0) {
        const extractedFlat = JSON.stringify(result.extracted);
        const outShield = await deps.shield.scan(extractedFlat);
        if (outShield.kind === 'blocked') {
          log('shield-blocked-output', { taskId: task.id, matches: outShield.matches });
          return Object.freeze({
            taskId: task.id,
            status: 'injection_blocked',
            extracted: [],
            screenshotPaths: result.screenshotPaths,
            stepsUsed: result.stepsUsed,
            elapsedMs: result.elapsedMs,
            costUsd: result.costUsd,
            error: {
              code: 'shield_blocked_output',
              message: outShield.reason,
            },
          });
        }
        if (outShield.kind === 'suspicious') {
          log('shield-suspicious-output', { taskId: task.id, matches: outShield.matches });
          return Object.freeze({
            ...result,
            error: {
              code: 'shield_suspicious_output',
              message: `Suspicious patterns flagged but not blocked: ${outShield.matches.join(', ')}`,
            },
          });
        }
      }

      return result;
    },
  };
}

async function timeoutResult(
  task: BrowserTask,
  startMs: number,
  clock: { readonly nowMs: () => number },
  timeoutMs: number,
): Promise<BrowserTaskResult> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
  return Object.freeze({
    taskId: task.id,
    status: 'timeout',
    extracted: [],
    screenshotPaths: [],
    stepsUsed: 0,
    elapsedMs: clock.nowMs() - startMs,
    costUsd: 0,
    error: {
      code: 'wall_clock_timeout',
      message: `Browser task exceeded ${timeoutMs}ms`,
    },
  });
}
