/**
 * Zod schemas for every shape we read out of `localStorage`.
 *
 * Closes round-3 finding C-6 (CRITICAL): unsafe deserialization. Any
 * transient XSS (e.g. C-1) can write `localStorage.setItem(...)` and
 * thereafter `JSON.parse(...)` returns an attacker-controlled object
 * that gets mounted straight into React state. Validating the shape
 * with Zod is a defence-in-depth measure: even when the bypass
 * succeeds, only well-formed payloads survive — anything else is
 * dropped and the key is purged.
 *
 * `z.object(...).strict()` rejects unknown keys including the
 * prototype-pollution keys `__proto__` and `constructor`.
 */

import { z } from 'zod';

const customerOrgMembershipSchema = z
  .object({
    id: z.string().min(1),
    organizationId: z.string().min(1),
    nickname: z.string().optional(),
    status: z.enum(['ACTIVE', 'LEFT', 'BLOCKED']),
  })
  .strict();

const customerUserSchema = z
  .object({
    id: z.string().min(1),
    phone: z.string().min(1),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().optional(),
    tenantIdentityId: z.string().optional(),
    memberships: z.array(customerOrgMembershipSchema).optional(),
    activeOrgId: z.string().optional(),
  })
  .strict();

export type ValidatedCustomerUser = z.infer<typeof customerUserSchema>;

/**
 * Parse a JSON string from localStorage and validate it. Returns the
 * validated object, or `null` if parsing or validation fails.
 *
 * Callers should treat `null` as "purge the bad entry from
 * localStorage and surface an unauthenticated state".
 */
export function parseStoredCustomerUser(raw: string | null): ValidatedCustomerUser | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = customerUserSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/**
 * Generic safe-JSON-parse + shape-validate helper. Returns the
 * validated value or `null`.
 */
export function safeParseFromStorage<T>(
  raw: string | null,
  schema: z.ZodType<T>,
): T | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}
