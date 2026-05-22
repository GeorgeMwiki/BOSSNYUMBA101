/**
 * Routing layer. Maps doc-type + extracted entities to module/action targets.
 *
 * Decision rules are declared once below — see `ROUTING_MATRIX`. Each entry
 * describes the target module, the action, and the minimum extracted-field
 * set that must be present for the routing to apply.
 *
 * Confidence: a routing's confidence is the minimum confidence among its
 * required fields, multiplied by the doc-type confidence. Below
 * `THRESHOLDS.AUTO_APPLY_ROUTING` the routing is HITL-gated.
 */

import type { ExtractedField } from '../extract/entity-extractor.js';
import {
  THRESHOLDS,
  type DocType,
  type Routing,
  type TargetModule,
} from '../types.js';

export interface RoutingDecision {
  readonly targetModule: TargetModule;
  readonly targetAction: string;
  readonly hitlRequired: boolean;
  readonly status: Routing['status'];
  readonly reasoning: Record<string, unknown>;
}

interface RoutingRule {
  readonly module: TargetModule;
  readonly action: string;
  /** All these extraction keys must be present (high-signal). */
  readonly requiredKeys: ReadonlyArray<string>;
  /** Optional — boost when these are present. */
  readonly optionalKeys?: ReadonlyArray<string>;
}

const ROUTING_MATRIX: Readonly<Record<Exclude<DocType, 'unknown'>, ReadonlyArray<RoutingRule>>> = {
  lease_application: [
    {
      module: 'estate',
      action: 'create_lease_application',
      requiredKeys: ['applicant_name', 'requested_asset'],
      optionalKeys: ['applicant_phone', 'applicant_nida', 'requested_rent'],
    },
  ],
  lease_contract: [
    {
      module: 'estate',
      action: 'create_lease',
      requiredKeys: ['tenant_name', 'asset_reference', 'monthly_rent'],
      optionalKeys: ['lease_start_date', 'lease_end_date', 'landlord_name'],
    },
  ],
  payment_receipt: [
    {
      module: 'finance',
      action: 'post_receipt',
      requiredKeys: ['amount'],
      optionalKeys: ['gepg_reference', 'mpesa_reference', 'payer_name', 'payment_date'],
    },
  ],
  national_id: [
    {
      module: 'compliance',
      action: 'archive_id',
      requiredKeys: ['id_number'],
      optionalKeys: ['full_name', 'date_of_birth'],
    },
  ],
  condition_survey: [
    {
      module: 'estate',
      action: 'update_condition',
      requiredKeys: ['asset_reference'],
      optionalKeys: ['inspection_date', 'inspector_name'],
    },
  ],
  complaint_letter: [
    {
      module: 'crm',
      action: 'open_ticket',
      requiredKeys: ['complainant_name'],
      optionalKeys: ['complaint_topic', 'asset_reference'],
    },
  ],
  renewal_request: [
    {
      module: 'estate',
      action: 'create_renewal_request',
      requiredKeys: ['tenant_name', 'asset_reference'],
      optionalKeys: ['requested_renewal_date'],
    },
  ],
  termination_notice: [
    {
      module: 'legal',
      action: 'process_termination',
      requiredKeys: ['tenant_name', 'asset_reference'],
      optionalKeys: ['effective_date'],
    },
  ],
  vendor_invoice: [
    {
      module: 'finance',
      action: 'process_invoice',
      requiredKeys: ['vendor_name', 'amount'],
      optionalKeys: ['invoice_number'],
    },
  ],
};

export interface DecideRoutingInput {
  readonly docType: DocType;
  readonly docTypeConfidence: number;
  readonly extractions: ReadonlyArray<ExtractedField>;
}

export function decideRouting(input: DecideRoutingInput): ReadonlyArray<RoutingDecision> {
  if (input.docType === 'unknown') {
    return [
      {
        targetModule: 'crm',
        targetAction: 'open_ticket',
        hitlRequired: true,
        status: 'pending',
        reasoning: {
          docType: 'unknown',
          docTypeConfidence: input.docTypeConfidence,
          rationale: 'no_doc_type_match',
        },
      },
    ];
  }

  const rules = ROUTING_MATRIX[input.docType];
  if (!rules || rules.length === 0) return [];

  const byKey = new Map<string, ExtractedField>();
  for (const ex of input.extractions) {
    byKey.set(ex.key, ex);
  }

  const out: RoutingDecision[] = [];

  for (const rule of rules) {
    const missing = rule.requiredKeys.filter((k) => !byKey.has(k));
    const present = rule.requiredKeys.filter((k) => byKey.has(k));
    const presentOptional = (rule.optionalKeys ?? []).filter((k) => byKey.has(k));

    if (missing.length > 0) {
      // Required entity missing → still route, but HITL-gated, so an operator
      // can fill in the blanks.
      out.push({
        targetModule: rule.module,
        targetAction: rule.action,
        hitlRequired: true,
        status: 'pending',
        reasoning: {
          docType: input.docType,
          docTypeConfidence: input.docTypeConfidence,
          requiredKeysMissing: missing,
          requiredKeysPresent: present,
          optionalKeysPresent: presentOptional,
          rationale: 'required_entity_missing',
        },
      });
      continue;
    }

    const minRequired = Math.min(
      ...rule.requiredKeys.map((k) => byKey.get(k)?.confidence ?? 0),
    );
    const combined = minRequired * input.docTypeConfidence;
    const autoApply = combined >= THRESHOLDS.AUTO_APPLY_ROUTING;

    out.push({
      targetModule: rule.module,
      targetAction: rule.action,
      hitlRequired: !autoApply,
      status: 'pending',
      reasoning: {
        docType: input.docType,
        docTypeConfidence: input.docTypeConfidence,
        minRequiredFieldConfidence: minRequired,
        combinedConfidence: combined,
        autoApplyThreshold: THRESHOLDS.AUTO_APPLY_ROUTING,
        requiredKeysPresent: present,
        optionalKeysPresent: presentOptional,
        rationale: autoApply ? 'auto_apply' : 'low_combined_confidence',
      },
    });
  }

  return out;
}

/** Exposed for tests + diagnostics. */
export { ROUTING_MATRIX };
