/**
 * Ambient declaration for @bossnyumba/domain-models in the database package.
 * Provides the subset of types used across repositories until domain-models
 * ships built declarations.
 */
declare module '@bossnyumba/domain-models' {
  export type TenantId = string;
  export type UserId = string;
  export type PropertyId = string;
  export type UnitId = string;
  export type LeaseId = string;
  export type CustomerId = string;
  export type OrganizationId = string;
  export type RoleId = string;

  export interface PaginationParams {
    limit: number;
    offset: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }

  export interface PaginatedResult<T> {
    items: readonly T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }
}

declare module 'bcrypt' {
  export function hash(data: string | Buffer, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string | Buffer, encrypted: string): Promise<boolean>;
  export function hashSync(data: string | Buffer, saltOrRounds: string | number): string;
  export function compareSync(data: string | Buffer, encrypted: string): boolean;
  export function genSalt(rounds?: number): Promise<string>;
  export function genSaltSync(rounds?: number): string;
  const _default: {
    hash: typeof hash;
    compare: typeof compare;
    hashSync: typeof hashSync;
    compareSync: typeof compareSync;
    genSalt: typeof genSalt;
    genSaltSync: typeof genSaltSync;
  };
  export default _default;
}
