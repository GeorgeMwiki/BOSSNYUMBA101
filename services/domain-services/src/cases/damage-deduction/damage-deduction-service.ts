/**
 * Damage-Deduction Service (stub structure).
 *
 * Implements state + negotiation-turn tracking. AI mediation, evidence
 * bundle assembly, and ledger posting are STUBBED — they throw
 * NOT_IMPLEMENTED pending the corresponding feature work.
 *
 * Spec: Docs/analysis/MISSING_FEATURES_DESIGN.md §8.
 */

import type { TenantId, UserId, ISOTimestamp, Result } from '@bossnyumba/domain-models';
import { ok, err } from '@bossnyumba/domain-models';
import { randomHex } from '../../common/id-generator.js';
import type {
  DamageDeductionCase,
  DamageDeductionCaseId,
  FileClaimInput,
  TenantRespondInput,
  AgreeAndSettleInput,
  NegotiationTurn,
} from './damage-deduction-case.js';
import { asDamageDeductionCaseId } from './damage-deduction-case.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const DamageDeductionError = {
  CLAIM_NOT_FOUND: 'CLAIM_NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  ILLEGAL_STATUS: 'ILLEGAL_STATUS',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type DamageDeductionErrorCode =
  (typeof DamageDeductionError)[keyof typeof DamageDeductionError];

export interface DamageDeductionErrorResult {
  code: DamageDeductionErrorCode;
  message: string;
}

// ---------------------------------------------------------------------------
// Repository contract
// ---------------------------------------------------------------------------

export interface DamageDeductionRepository {
  findById(id: DamageDeductionCaseId, tenantId: TenantId): Promise<DamageDeductionCase | null>;
  create(entity: DamageDeductionCase): Promise<DamageDeductionCase>;
  update(entity: DamageDeductionCase): Promise<DamageDeductionCase>;
}

// ---------------------------------------------------------------------------
// Evidence bundle gateway (thin wrapper over document-intelligence)
// ---------------------------------------------------------------------------

export interface EvidenceBundleGateway {
  buildForDamageClaim(params: {
    tenantId: TenantId;
    damageCaseId: DamageDeductionCaseId;
    actor: UserId;
  }): Promise<{ bundleId: string }>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DamageDeductionService {
  constructor(
    private repo: DamageDeductionRepository,
    private readonly evidenceBundle?: EvidenceBundleGateway
  ) {}

  /**
   * Swap the backing repository at runtime (additive hook for Wave 3
   * wiring — stub-based tests use the constructor path, production wires
   * the Postgres repo via `attachRepository`).
   */
  attachRepository(repo: DamageDeductionRepository): void {
    this.repo = repo;
  }

  async fileClaim(
    tenantId: TenantId,
    input: FileClaimInput,
    actor: UserId
  ): Promise<Result<DamageDeductionCase, DamageDeductionErrorResult>> {
    if (!input.claimedDeductionMinor || input.claimedDeductionMinor <= 0) {
      return err({
        code: DamageDeductionError.INVALID_INPUT,
        message: 'claimedDeductionMinor must be positive',
      });
    }
    const now = new Date().toISOString() as ISOTimestamp;
    const entity: DamageDeductionCase = {
      id: asDamageDeductionCaseId(`ddc_${Date.now()}_${randomHex(4)}`),
      tenantId,
      leaseId: input.leaseId,
      caseId: input.caseId,
      moveOutInspectionId: input.moveOutInspectionId,
      claimedDeductionMinor: input.claimedDeductionMinor,
      currency: input.currency ?? 'TZS',
      status: 'claim_filed',
      aiMediatorTurns: [
        {
          id: `turn_${Date.now()}_${randomHex(2)}`,
          actor: 'owner',
          actorId: actor,
          proposedAmountMinor: input.claimedDeductionMinor,
          rationale: input.rationale,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    };
    const saved = await this.repo.create(entity);
    return ok(saved);
  }

  async tenantRespond(
    id: DamageDeductionCaseId,
    tenantId: TenantId,
    input: TenantRespondInput,
    actor: UserId
  ): Promise<Result<DamageDeductionCase, DamageDeductionErrorResult>> {
    const entity = await this.repo.findById(id, tenantId);
    if (!entity) {
      return err({ code: DamageDeductionError.CLAIM_NOT_FOUND, message: 'Claim not found' });
    }
    if (entity.status !== 'claim_filed' && entity.status !== 'negotiating') {
      return err({
        code: DamageDeductionError.ILLEGAL_STATUS,
        message: `Cannot respond when status is ${entity.status}`,
      });
    }
    const now = new Date().toISOString() as ISOTimestamp;
    const turn: NegotiationTurn = {
      id: `turn_${Date.now()}_${randomHex(2)}`,
      actor: 'tenant',
      actorId: actor,
      proposedAmountMinor: input.counterProposalMinor,
      rationale: input.rationale,
      createdAt: now,
    };
    const updated: DamageDeductionCase = {
      ...entity,
      tenantCounterProposalMinor: input.counterProposalMinor ?? entity.tenantCounterProposalMinor,
      status: 'tenant_responded',
      aiMediatorTurns: [...entity.aiMediatorTurns, turn],
      updatedAt: now,
      updatedBy: actor,
    };
    const saved = await this.repo.update(updated);
    return ok(saved);
  }

  /**
   * AI mediation — STUBBED.
   *
   * Will: invoke Estate Manager Brain with mediator prompt, produce a
   * proposed midpoint + rationale, persist as a `ai_mediator` turn,
   * and gate above owner-configured threshold via Opus advisor.
   */
  async aiMediate(
    _id: DamageDeductionCaseId,
    _tenantId: TenantId,
    _actor: UserId
  ): Promise<Result<DamageDeductionCase, DamageDeductionErrorResult>> {
    return err({
      code: DamageDeductionError.NOT_IMPLEMENTED,
      message: 'AI mediator pending (MISSING_FEATURES_DESIGN.md §8)',
    });
  }

  /**
   * Evidence bundle — DELEGATES to document-intelligence builder.
   * Throws NOT_IMPLEMENTED if the gateway was not wired at construction.
   */
  async buildEvidenceBundle(
    id: DamageDeductionCaseId,
    tenantId: TenantId,
    actor: UserId
  ): Promise<Result<{ bundleId: string }, DamageDeductionErrorResult>> {
    if (!this.evidenceBundle) {
      return err({
        code: DamageDeductionError.NOT_IMPLEMENTED,
        message: 'EvidenceBundleGateway not configured',
      });
    }
    const result = await this.evidenceBundle.buildForDamageClaim({
      tenantId,
      damageCaseId: id,
      actor,
    });
    return ok(result);
  }

  /**
   * Agree + settle — STUBBED ledger write.
   *
   * Will post an adjustment ledger entry via #4 mechanism once the
   * deposit ledger is complete. For now the service records agreement
   * state only.
   */
  async agreeAndSettle(
    id: DamageDeductionCaseId,
    tenantId: TenantId,
    input: AgreeAndSettleInput,
    actor: UserId
  ): Promise<Result<DamageDeductionCase, DamageDeductionErrorResult>> {
    const entity = await this.repo.findById(id, tenantId);
    if (!entity) {
      return err({ code: DamageDeductionError.CLAIM_NOT_FOUND, message: 'Claim not found' });
    }
    const now = new Date().toISOString() as ISOTimestamp;
    const updated: DamageDeductionCase = {
      ...entity,
      proposedDeductionMinor: input.agreedAmountMinor,
      status: 'agreed',
      updatedAt: now,
      updatedBy: actor,
    };
    const saved = await this.repo.update(updated);
    // NOTE: ledger posting stub — tracked under MISSING_FEATURES_DESIGN.md §4 (Deposit Ledger).
    return ok(saved);
  }
}
