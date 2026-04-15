/**
 * Ambient declaration for @bossnyumba/domain-models when package has no .d.ts
 * Remove when domain-models emits declarations
 */
declare module '@bossnyumba/domain-models' {
  export type TenantId = string;
  export type OrganizationId = string;
  export type RoleId = string;
  export type UserId = string;
  export type PolicyId = string;
  export type SessionId = string;

  export interface UserRoleAssignment {
    roleId: RoleId;
    organizationId: OrganizationId;
    expiresAt?: string;
  }

  export interface User {
    id: UserId;
    tenantId: TenantId;
    type: string;
    primaryOrganizationId: OrganizationId;
    roleAssignments: UserRoleAssignment[];
    security: { mfaEnabled: boolean };
  }

  export interface Role {
    id: RoleId;
    name: string;
    permissions: string[];
    inheritsFrom: RoleId[];
    isAdmin: boolean;
    priority: number;
  }

  export interface AuthorizationRequest {
    subject: SubjectAttributes;
    action: ActionAttributes;
    resource: ResourceAttributes;
    context: ContextAttributes;
  }

  export interface AuthorizationDecision {
    allowed: boolean;
    reason?: string;
    decidingPolicyId?: PolicyId | null;
    decidingRuleIndex?: number | null;
    evaluationTrace?: PolicyEvaluationResult[];
  }

  export interface SubjectAttributes {
    userId: string;
    tenantId: string;
    userType: string;
    roleIds: string[];
    organizationIds: string[];
    primaryOrganizationId: string;
    permissions: string[];
    mfaVerified: boolean;
    metadata?: Record<string, unknown>;
  }

  export interface ResourceAttributes {
    type: string;
    id: string | null;
    ownerId: string | null;
    tenantId: string;
    organizationId: string | null;
    metadata?: Record<string, unknown>;
  }

  export interface ContextAttributes {
    ipAddress: string;
    userAgent: string;
    timestamp: string;
    requestId: string;
    sessionId: string | null;
    metadata?: Record<string, unknown>;
  }

  export interface ActionAttributes {
    name: string;
    resource: string;
    metadata?: Record<string, unknown>;
  }

  export interface PolicyCondition {
    source: AttributeSource;
    attribute: string;
    operator: ConditionOperator;
    value: unknown;
  }

  export interface ConditionGroup {
    logic: 'AND' | 'OR';
    conditions: Array<PolicyCondition | ConditionGroup>;
  }

  export interface PolicyTargetPrincipals {
    userIds: string[];
    roleIds: string[];
    userTypes: string[];
  }

  export interface Policy {
    id: PolicyId;
    name: string;
    description?: string;
    effect?: PolicyEffect;
    priority: number;
    targetPrincipals: PolicyTargetPrincipals;
    targetOrganizations: string[];
    rules: PolicyRule[];
  }

  export interface PolicyRule {
    id: string;
    effect: PolicyEffect;
    actions: string[];
    resources: string[];
    conditions?: ConditionGroup;
  }

  export interface PolicyEvaluationResult {
    policyId: PolicyId;
    policyName: string;
    matched: boolean;
    effect: PolicyEffect | null;
    matchedRuleIndex: number | null;
    evaluationTimeMs: number;
  }

  export const PolicyEffect: {
    readonly ALLOW: 'allow';
    readonly DENY: 'deny';
  };
  export type PolicyEffect = (typeof PolicyEffect)[keyof typeof PolicyEffect];

  export const PolicyStatus: {
    readonly ACTIVE: 'active';
    readonly INACTIVE: 'inactive';
    readonly DRAFT: 'draft';
  };
  export type PolicyStatus = (typeof PolicyStatus)[keyof typeof PolicyStatus];

  export const ConditionOperator: {
    readonly EQUALS: 'eq';
    readonly NOT_EQUALS: 'neq';
    readonly GREATER_THAN: 'gt';
    readonly GREATER_THAN_OR_EQUALS: 'gte';
    readonly LESS_THAN: 'lt';
    readonly LESS_THAN_OR_EQUALS: 'lte';
    readonly IN: 'in';
    readonly NOT_IN: 'nin';
    readonly CONTAINS: 'contains';
    readonly NOT_CONTAINS: 'ncontains';
    readonly STARTS_WITH: 'starts_with';
    readonly ENDS_WITH: 'ends_with';
    readonly MATCHES: 'matches';
    readonly EXISTS: 'exists';
    readonly IS_OWNER: 'is_owner';
    readonly IN_ORG_HIERARCHY: 'in_org_hierarchy';
  };
  export type ConditionOperator = (typeof ConditionOperator)[keyof typeof ConditionOperator];

  export const AttributeSource: {
    readonly SUBJECT: 'subject';
    readonly RESOURCE: 'resource';
    readonly CONTEXT: 'context';
    readonly ACTION: 'action';
  };
  export type AttributeSource = (typeof AttributeSource)[keyof typeof AttributeSource];

  export interface AccessTokenClaims {
    sub: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    tenantId?: string;
    iat?: number;
    exp?: number;
  }

  export interface TenantScoped {
    tenantId: TenantId;
  }

  export function asTenantId(value: string): TenantId;
  export function asUserId(value: string): UserId;
  export function asOrganizationId(value: string): OrganizationId;
  export function asRoleId(value: string): RoleId;
  export function permissionMatches(granted: string, required: string): boolean;
}
