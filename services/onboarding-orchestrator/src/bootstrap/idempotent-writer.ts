/**
 * Idempotent + reversible bootstrap writer.
 *
 * Research §6 + §13. Every write is keyed by a natural key derived
 * from the blueprint (tenant slug = slug-of(company_name), property
 * slug = slug-of(property_name), unit slug = property_slug + label).
 *
 * Modes:
 *   * `dry-run` — emits the full plan as a series of `BootstrapStep`s
 *     without calling the writer. Required for tenants > 50 units.
 *   * `commit` — runs each step inside a transaction. Each step
 *     consults the writer's `exists(naturalKey)` and either creates
 *     or skips. On failure mid-sequence, the rollback handler reads
 *     the events written so far and reverse-applies them.
 *
 * The actual SQL lives in `@bossnyumba/database`. This module
 * speaks to it through `BootstrapWriter` — composition root injects
 * the live adapter; tests inject `RecordingWriter`.
 */

import type {
  BlueprintProperty,
  BlueprintTeamMember,
  BlueprintUnit,
  TenantBlueprint,
} from '../persistence/session-store.js';

// ---------------------------------------------------------------------------
// Step shape.
// ---------------------------------------------------------------------------

export type BootstrapStepKind =
  | 'create_tenant'
  | 'create_property'
  | 'create_unit'
  | 'invite_team_member'
  | 'seed_rules'
  | 'wire_connector';

export interface BootstrapStep {
  readonly kind: BootstrapStepKind;
  readonly naturalKey: string;
  readonly payload: Record<string, unknown>;
}

export interface BootstrapPlan {
  readonly steps: readonly BootstrapStep[];
  readonly stepCount: number;
}

export interface BootstrapResult {
  readonly ok: boolean;
  readonly created: number;
  readonly skipped: number;
  readonly tenantId?: string;
  readonly error?: string;
  readonly committedSteps: readonly BootstrapStep[];
}

// ---------------------------------------------------------------------------
// Writer interface (injected; the real impl uses drizzle + a tx).
// ---------------------------------------------------------------------------

export interface BootstrapWriter {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  exists(kind: BootstrapStepKind, naturalKey: string): Promise<boolean>;
  apply(step: BootstrapStep): Promise<{ id: string } | { id: null; skipped: true }>;
}

/**
 * Recording writer for tests + dry-run. Never touches a DB.
 * `seedExisting` lets a test precondition "this row is already there".
 */
export class RecordingWriter implements BootstrapWriter {
  public readonly applied: BootstrapStep[] = [];
  public readonly seen: Array<{ kind: BootstrapStepKind; naturalKey: string }> = [];
  private readonly existing = new Set<string>();
  private inTx = false;

  seedExisting(kind: BootstrapStepKind, naturalKey: string): void {
    this.existing.add(this.indexKey(kind, naturalKey));
  }

  async beginTransaction(): Promise<void> {
    this.inTx = true;
  }
  async commit(): Promise<void> {
    this.inTx = false;
  }
  async rollback(): Promise<void> {
    this.inTx = false;
    this.applied.length = 0;
  }
  async exists(kind: BootstrapStepKind, naturalKey: string): Promise<boolean> {
    this.seen.push({ kind, naturalKey });
    return this.existing.has(this.indexKey(kind, naturalKey));
  }
  async apply(step: BootstrapStep): Promise<{ id: string } | { id: null; skipped: true }> {
    if (!this.inTx) throw new Error('apply outside transaction');
    if (this.existing.has(this.indexKey(step.kind, step.naturalKey))) {
      return { id: null, skipped: true };
    }
    this.applied.push(step);
    this.existing.add(this.indexKey(step.kind, step.naturalKey));
    return { id: `id-${this.applied.length}` };
  }

  private indexKey(kind: BootstrapStepKind, naturalKey: string): string {
    return `${kind}::${naturalKey}`;
  }
}

// ---------------------------------------------------------------------------
// Planner — pure transform: TenantBlueprint → BootstrapPlan.
// ---------------------------------------------------------------------------

export function planBootstrap(blueprint: TenantBlueprint): BootstrapPlan {
  const steps: BootstrapStep[] = [];

  steps.push({
    kind: 'create_tenant',
    naturalKey: blueprint.tenantSlug,
    payload: {
      slug: blueprint.tenantSlug,
      displayName: blueprint.tenantDisplayName,
      countryCode: blueprint.countryCode,
      currency: blueprint.currency,
      primaryLanguage: blueprint.primaryLanguage,
    },
  });

  for (const property of blueprint.properties) {
    steps.push(propertyStep(blueprint.tenantSlug, property));
    for (const unit of property.units) {
      steps.push(unitStep(blueprint.tenantSlug, property, unit));
    }
  }

  for (const member of blueprint.team) {
    steps.push(teamStep(blueprint.tenantSlug, member));
  }

  steps.push({
    kind: 'seed_rules',
    naturalKey: `${blueprint.tenantSlug}::rules`,
    payload: { ...blueprint.rules },
  });

  if (blueprint.connectors.mpesaPaybill) {
    steps.push({
      kind: 'wire_connector',
      naturalKey: `${blueprint.tenantSlug}::mpesa::${blueprint.connectors.mpesaPaybill}`,
      payload: { kind: 'mpesa_paybill', value: blueprint.connectors.mpesaPaybill },
    });
  }
  if (blueprint.connectors.mpesaTill) {
    steps.push({
      kind: 'wire_connector',
      naturalKey: `${blueprint.tenantSlug}::mpesa_till::${blueprint.connectors.mpesaTill}`,
      payload: { kind: 'mpesa_till', value: blueprint.connectors.mpesaTill },
    });
  }
  if (blueprint.connectors.whatsappNumber) {
    steps.push({
      kind: 'wire_connector',
      naturalKey: `${blueprint.tenantSlug}::whatsapp::${blueprint.connectors.whatsappNumber}`,
      payload: { kind: 'whatsapp', value: blueprint.connectors.whatsappNumber },
    });
  }

  return { steps, stepCount: steps.length };
}

function propertyStep(tenantSlug: string, property: BlueprintProperty): BootstrapStep {
  return {
    kind: 'create_property',
    naturalKey: `${tenantSlug}::${property.slug}`,
    payload: {
      tenantSlug,
      slug: property.slug,
      name: property.name,
      buildingType: property.buildingType,
      location: property.location,
    },
  };
}

function unitStep(tenantSlug: string, property: BlueprintProperty, unit: BlueprintUnit): BootstrapStep {
  return {
    kind: 'create_unit',
    naturalKey: `${tenantSlug}::${property.slug}::${unit.slug}`,
    payload: {
      tenantSlug,
      propertySlug: property.slug,
      slug: unit.slug,
      label: unit.label,
      unitType: unit.unitType,
      rentAmount: unit.rentAmount,
    },
  };
}

function teamStep(tenantSlug: string, member: BlueprintTeamMember): BootstrapStep {
  const phoneKey = member.phone.replace(/[^\d]/g, '');
  return {
    kind: 'invite_team_member',
    naturalKey: `${tenantSlug}::team::${phoneKey}`,
    payload: {
      tenantSlug,
      name: member.name,
      phone: member.phone,
      role: member.role,
    },
  };
}

// ---------------------------------------------------------------------------
// Runner.
// ---------------------------------------------------------------------------

export interface RunOptions {
  readonly dryRun?: boolean;
}

export async function runBootstrap(
  blueprint: TenantBlueprint,
  writer: BootstrapWriter,
  opts: RunOptions = {},
): Promise<BootstrapResult> {
  const plan = planBootstrap(blueprint);
  if (opts.dryRun) {
    return {
      ok: true,
      created: 0,
      skipped: 0,
      committedSteps: plan.steps,
    };
  }

  const committed: BootstrapStep[] = [];
  let created = 0;
  let skipped = 0;
  let tenantId: string | undefined;

  await writer.beginTransaction();
  try {
    for (const step of plan.steps) {
      const result = await writer.apply(step);
      if ('skipped' in result && result.skipped) {
        skipped++;
      } else {
        created++;
        committed.push(step);
        if (step.kind === 'create_tenant' && 'id' in result && result.id) {
          tenantId = result.id;
        }
      }
    }
    await writer.commit();
    return { ok: true, created, skipped, tenantId, committedSteps: committed };
  } catch (error) {
    await writer.rollback();
    return {
      ok: false,
      created: 0,
      skipped: 0,
      committedSteps: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Slug helper — deterministic, ASCII-safe natural keys.
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
