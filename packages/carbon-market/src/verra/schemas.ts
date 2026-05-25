/**
 * Zod schemas matching the Verra public registry API.
 *
 * The registry's public-facing JSON shapes are not formally documented,
 * so the schemas accept the *minimum* fields we depend on plus
 * `passthrough()` for unknown keys — the goal is to be resilient to
 * Verra adding fields without breaking our parse.
 *
 * Public API base: see `client.ts` `VERRA_REGISTRY_BASE_URL`.
 */

import { z } from 'zod';

/** Verra project status (from registry UI; small finite enum). */
export const VerraStatusSchema = z.enum([
  'Registered',
  'Under Validation',
  'Under Development',
  'Withdrawn',
  'Rejected',
  'On Hold',
]);

/** Raw project record returned by `/searchProjects` and `/getProject`. */
export const RawProjectSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform((v) => String(v)),
    name: z.string(),
    country: z.string().length(2),
    methodology: z.string(),
    projectType: z.string().default('Unknown'),
    status: VerraStatusSchema,
    registryUrl: z.string().url().optional(),
    proponent: z.string().default('Unknown'),
    lastIssuanceDate: z.string().nullable().default(null),
    totalIssuedTonnes: z.number().nonnegative().default(0),
  })
  .passthrough();

export const ProjectListSchema = z
  .object({
    projects: z.array(RawProjectSchema),
    /** Some Verra endpoints paginate via `next` cursor. */
    next: z.string().nullable().optional(),
  })
  .passthrough();

export const RawIssuanceSchema = z
  .object({
    projectId: z.union([z.string(), z.number()]).transform((v) => String(v)),
    serialNumber: z.string().min(1),
    vintage: z.number().int().min(1990).max(2100),
    tonnes: z.number().nonnegative(),
    issuanceDate: z.string(),
    retired: z.boolean().default(false),
  })
  .passthrough();

export const IssuanceListSchema = z
  .object({
    issuances: z.array(RawIssuanceSchema),
    next: z.string().nullable().optional(),
  })
  .passthrough();

export type RawProject = z.infer<typeof RawProjectSchema>;
export type RawIssuance = z.infer<typeof RawIssuanceSchema>;
