import type { EntityType } from './queue'

/**
 * Explicit overrides for entity types whose path doesn't follow the default
 * `<entityType>s` plural rule. Kept tiny on purpose — anything not listed
 * here flows through `endpointFor` and gets the default pluralisation.
 *
 * Most entity types resolve via the default snake→kebab + 's' rule; only the
 * few whose backend segment differs are listed here.
 */
const ENDPOINT_OVERRIDES: Readonly<Partial<Record<EntityType, string>>> = {
  shift_report: 'shift-reports',
  fuel_log: 'materials-logs',
  attendance: 'attendance'
}

/**
 * Resolve the api-gateway path segment for a queued entity. Returns the
 * relative path (no leading slash) so callers can compose against
 * `${API_BASE_URL}/api/v1/manager/<path>`.
 *
 * Default rule: convert snake_case → kebab-case and append 's' unless the
 * type is in ENDPOINT_OVERRIDES.
 */
export function endpointFor(entityType: EntityType): string {
  const override = ENDPOINT_OVERRIDES[entityType]
  if (override) {
    return override
  }
  const kebab = entityType.replace(/_/gu, '-')
  return `${kebab}s`
}

/**
 * Backwards-compatible map for callers that prefer a static lookup. New
 * code should call `endpointFor()` so override behaviour stays in one
 * place. Each value is a relative path (no leading slash) under the
 * operator prefix.
 */
export const ENTITY_ENDPOINTS: Readonly<Record<EntityType, string>> = {
  shift_report: 'shift-reports',
  incident: endpointFor('incident'),
  attendance: 'attendance',
  fingerprint_sign: endpointFor('fingerprint_sign'),
  fuel_log: 'materials-logs',
  photo_upload: endpointFor('photo_upload'),
  inventory_move: endpointFor('inventory_move'),
  voice_query: endpointFor('voice_query'),
  driver_letter_ack: endpointFor('driver_letter_ack'),
  task_ack: endpointFor('task_ack'),
  ppe_receipt: endpointFor('ppe_receipt'),
  unit_check: endpointFor('unit_check'),
  inspection: endpointFor('inspection')
}
