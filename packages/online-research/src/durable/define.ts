/**
 * `defineDurableFlow` — builder for an Inngest-AgentKit-style durable
 * flow.
 *
 * The flow definition is just data. Wiring it to the actual Inngest
 * runtime is the `DurableEnginePort`'s job — we keep the definition
 * shape engine-agnostic so the in-memory adapter (for tests) and the
 * production Inngest adapter share it.
 *
 * Steps are run in deterministic order. The engine adapter checkpoints
 * each step's output so a crash mid-flow resumes from the last
 * completed step.
 */

import { z } from 'zod';
import type { DurableFlowDefinition, DurableStep } from '../types/index.js';

export interface DefineDurableFlowInput<TArgs> {
  readonly name: string;
  readonly version: string;
  readonly maxRunHours?: number;
  readonly steps: ReadonlyArray<DurableStep>;
  readonly argsSchema: z.ZodType<TArgs>;
}

export function defineDurableFlow<TArgs>(
  input: DefineDurableFlowInput<TArgs>,
): DurableFlowDefinition<TArgs> {
  if (input.steps.length === 0) {
    throw new Error(`Flow ${input.name} must have at least one step`);
  }
  const stepNames = new Set<string>();
  for (const step of input.steps) {
    if (stepNames.has(step.name)) {
      throw new Error(`Duplicate step name "${step.name}" in flow ${input.name}`);
    }
    stepNames.add(step.name);
    if (step.idempotencyKey.length === 0) {
      throw new Error(`Step "${step.name}" must declare an idempotencyKey`);
    }
  }

  return Object.freeze({
    name: input.name,
    version: input.version,
    ...(input.maxRunHours !== undefined ? { maxRunHours: input.maxRunHours } : {}),
    steps: Object.freeze([...input.steps]),
    argsSchema: input.argsSchema,
  });
}
