/**
 * Student-client resolver.
 *
 * Picks the right adapter based on the environment:
 *   1. If STUDENT_MODEL_PATH is set AND the active adapter reports
 *      ready → use it.
 *   2. Otherwise → return the N-C cost-cascade Haiku fallback (a
 *      caller-supplied port).
 *
 * The resolver does NOT itself load checkpoints; that's the trainer's
 * job. It only routes between configured adapters.
 */

import type {
  IStudentModelClient,
  StudentInvokeInput,
  StudentInvokeOutput,
} from './student-client.js';

export interface StudentResolutionInput {
  /** Primary student adapter to try (typically Ollama or vLLM). */
  readonly primary?: IStudentModelClient;
  /** Fallback to N-C's cost-cascade Haiku (mandatory). */
  readonly fallback: IStudentModelClient | NcCostCascadeFallback;
  /** Env var the trainer writes when a checkpoint is loaded. */
  readonly studentModelPath?: string | undefined;
}

/**
 * Minimal port for N-C's cost-cascade Haiku tier. Phase N-C exposes its
 * own router; this interface lets the resolver call it without taking a
 * direct dependency on `@bossnyumba/...n-c`.
 */
export interface NcCostCascadeFallback {
  invoke(input: StudentInvokeInput): Promise<StudentInvokeOutput>;
}

/**
 * Returns a single client that internally routes:
 *   - to `primary` when STUDENT_MODEL_PATH is set AND primary.isReady()
 *   - otherwise to the N-C cost-cascade fallback
 *
 * The returned object is itself an IStudentModelClient (adapter
 * 'fallback' when in cascade mode).
 */
export async function resolveStudentClient(
  input: StudentResolutionInput,
): Promise<IStudentModelClient> {
  if (input.studentModelPath && input.primary) {
    const ready = await input.primary.isReady();
    if (ready) return input.primary;
  }
  // Fallback path — N-C cost-cascade. Wrap in IStudentModelClient shape.
  return Object.freeze({
    adapter: 'fallback' as const,
    isReady: async () => true,
    invoke: (request: StudentInvokeInput) => input.fallback.invoke(request),
  });
}
