/**
 * VerticalPack — binds the 6 generic substrate primitives to specific
 * entity types + connectors for a single domain.
 *
 * A pack is a CONFIGURATION of the substrate, not a fork of it. The
 * substrate stays domain-agnostic; the pack supplies:
 *
 *   - `entity_types`     the nouns this pack operates on (Maintenance
 *                        Ticket, Hiring Pipeline, Churn Risk Owner, …)
 *   - `sub_mds`          each sub-MD = { name, primitive specs, wiring }
 *   - `jurisdiction_rules?`  per-country defaults (currency, locale, tax)
 *   - `connectors?`      transport ports the dispatch primitive binds to
 *                        (email-svc, sms-svc, CRM, ATS, …)
 *
 * Verticals shipped in this phase:
 *   - property-management   (BOSSNYUMBA → owner-customer flows)
 *   - bossnyumba-internal   (BOSSNYUMBA org running itself)
 *
 * Vertical packs DO NOT have a hard dependency on a connector
 * implementation. They declare the SHAPE of the connector they need
 * (a port type) and the runtime injects the implementation.
 */

import type { PrimitiveKind } from '../types.js';

export interface JurisdictionRules {
  readonly countryCode: string;
  readonly currency: string;
  readonly defaultLanguageTag: string;
  /** Whether this jurisdiction requires e-receipts (e.g. KE/KRA). */
  readonly requiresEReceipts?: boolean;
  /** Maximum unattended SMS chase rungs allowed (compliance). */
  readonly maxUnattendedChaseRungs?: number;
}

export interface ConnectorRequirement {
  readonly name: string;
  readonly kind: 'email' | 'sms' | 'voice' | 'webhook' | 'crm' | 'ats' | 'payroll' | 'accounting';
  readonly portType: string;
  readonly required: boolean;
}

export interface SubMdSpec {
  readonly name: string;
  readonly description: string;
  /**
   * Which substrate primitives this sub-MD COMPOSES. A sub-MD is a
   * directed pipeline of primitives; the runtime wires them in order.
   */
  readonly primitives: ReadonlyArray<{
    readonly kind: PrimitiveKind;
    readonly name: string;
    readonly notes: string;
  }>;
  /** Entity types the sub-MD touches. Drawn from pack.entity_types. */
  readonly entityTypes: ReadonlyArray<string>;
  /** Connector names the sub-MD requires. Drawn from pack.connectors. */
  readonly connectorsRequired: ReadonlyArray<string>;
  /** Default permission mode for this sub-MD (owner can override). */
  readonly defaultPermissionMode: 'dry-run' | 'propose' | 'act-on-yes' | 'auto';
}

export interface VerticalPack {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly version: string;
  readonly entityTypes: ReadonlyArray<string>;
  readonly subMds: ReadonlyArray<SubMdSpec>;
  readonly jurisdictionRules?: ReadonlyArray<JurisdictionRules>;
  readonly connectors?: ReadonlyArray<ConnectorRequirement>;
}

// ─────────────────────────────────────────────────────────────────────
// Pack validation — runtime sanity check the loader runs.
// ─────────────────────────────────────────────────────────────────────

export type PackValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: ReadonlyArray<string> };

export function validatePack(pack: VerticalPack): PackValidation {
  const errors: string[] = [];

  if (!pack.name || !/^[a-z][a-z0-9-]+$/.test(pack.name)) {
    errors.push(`pack.name "${pack.name}" must be kebab-case`);
  }
  if (pack.subMds.length === 0) errors.push('pack.subMds must be non-empty');
  if (pack.entityTypes.length === 0) {
    errors.push('pack.entityTypes must be non-empty');
  }

  const subMdNames = new Set<string>();
  for (const sm of pack.subMds) {
    if (subMdNames.has(sm.name)) {
      errors.push(`duplicate sub-MD name "${sm.name}"`);
    }
    subMdNames.add(sm.name);
    if (sm.primitives.length === 0) {
      errors.push(`sub-MD "${sm.name}" has no primitives`);
    }
    for (const et of sm.entityTypes) {
      if (!pack.entityTypes.includes(et)) {
        errors.push(`sub-MD "${sm.name}" references unknown entity type "${et}"`);
      }
    }
    const connectorNames = new Set(pack.connectors?.map((c) => c.name) ?? []);
    for (const cn of sm.connectorsRequired) {
      if (!connectorNames.has(cn)) {
        errors.push(`sub-MD "${sm.name}" requires unknown connector "${cn}"`);
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
