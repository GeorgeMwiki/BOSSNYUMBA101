/**
 * Tests for the tenant-scoped Cypher helper. Covers:
 *   - runtime rejection of queries that omit $tenantId
 *   - rejection of empty / missing tenantId param
 *   - successful read/write delegation when scoped properly
 *   - cross-tenant-leak negative path (a query that would have leaked
 *     in the original Neo4jClient is refused here)
 *   - scopeNodePattern utility correctness
 */

import { describe, it, expect } from 'vitest';
import {
  assertCypherReferencesTenantId,
  createTenantScopedCypher,
  scopeNodePattern,
  scopeAllNodePatterns,
  TenantScopeViolation,
  type Neo4jReadClient,
  type Neo4jWriteClient,
} from '../client/tenant-scoped-cypher.js';

function fakeReader(): Neo4jReadClient & {
  calls: Array<{ cypher: string; params: Record<string, unknown> }>;
} {
  const calls: Array<{ cypher: string; params: Record<string, unknown> }> = [];
  return {
    calls,
    async readQuery<T>(cypher: string, params?: Record<string, unknown>) {
      calls.push({ cypher, params: params ?? {} });
      return [] as T[];
    },
  };
}

function fakeWriter(): Neo4jWriteClient & {
  calls: Array<{ cypher: string; params: Record<string, unknown> }>;
} {
  const calls: Array<{ cypher: string; params: Record<string, unknown> }> = [];
  return {
    calls,
    async writeQuery<T>(cypher: string, params?: Record<string, unknown>) {
      calls.push({ cypher, params: params ?? {} });
      return [] as T[];
    },
  };
}

describe('assertCypherReferencesTenantId', () => {
  it('accepts queries that reference $tenantId', () => {
    expect(() =>
      assertCypherReferencesTenantId(
        'MATCH (p:Property {_tenantId: $tenantId}) RETURN p',
      ),
    ).not.toThrow();
  });

  it('rejects queries that omit $tenantId', () => {
    expect(() =>
      assertCypherReferencesTenantId('MATCH (p:Property) RETURN p'),
    ).toThrow(TenantScopeViolation);
  });

  it('does NOT confuse a literal "tenantId" without $ with the param', () => {
    expect(() =>
      assertCypherReferencesTenantId('MATCH (p {tenantId: "abc"}) RETURN p'),
    ).toThrow(TenantScopeViolation);
  });

  /**
   * H16 closure (round-3 audit): the OLD substring-only check passed
   * for `RETURN $tenantId AS x` (no filter) and for the LHS
   * short-circuit pattern `WHERE 1=1 OR a._tenantId = $tenantId`.
   * The new check requires a BIND (`_tenantId: $tenantId` in a bag
   * or `<x>._tenantId = $tenantId` in a WHERE) AND rejects the
   * disjunction-bypass pattern explicitly.
   */
  it('rejects a query that only RETURNs $tenantId (no filter)', () => {
    expect(() =>
      assertCypherReferencesTenantId('RETURN $tenantId AS x'),
    ).toThrow(TenantScopeViolation);
  });

  it('rejects the 1=1 OR disjunction bypass pattern', () => {
    expect(() =>
      assertCypherReferencesTenantId(
        'MATCH (a) WHERE 1=1 OR a._tenantId = $tenantId RETURN a',
      ),
    ).toThrow(TenantScopeViolation);
  });

  it('rejects the true OR disjunction bypass pattern', () => {
    expect(() =>
      assertCypherReferencesTenantId(
        'MATCH (a) WHERE true OR a._tenantId = $tenantId RETURN a',
      ),
    ).toThrow(TenantScopeViolation);
  });

  it('accepts a WHERE-clause bind that uses dotted attribute access', () => {
    expect(() =>
      assertCypherReferencesTenantId(
        'MATCH (a:Property) WHERE a._tenantId = $tenantId RETURN a',
      ),
    ).not.toThrow();
  });
});

describe('createTenantScopedCypher — readScoped', () => {
  it('delegates to the underlying reader when query is scoped', async () => {
    const reader = fakeReader();
    const client = createTenantScopedCypher({ reader });
    await client.readScoped<{ id: string }>(
      'MATCH (p:Property {_tenantId: $tenantId}) RETURN p._id AS id',
      { tenantId: 'tenant-1' },
    );
    expect(reader.calls.length).toBe(1);
    expect(reader.calls[0]!.params.tenantId).toBe('tenant-1');
  });

  it('rejects a query without $tenantId reference', async () => {
    const reader = fakeReader();
    const client = createTenantScopedCypher({ reader });
    await expect(
      client.readScoped('MATCH (p:Property) RETURN p', { tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(TenantScopeViolation);
    expect(reader.calls.length).toBe(0);
  });

  it('rejects an empty tenantId param', async () => {
    const reader = fakeReader();
    const client = createTenantScopedCypher({ reader });
    await expect(
      client.readScoped(
        'MATCH (p:Property {_tenantId: $tenantId}) RETURN p',
        { tenantId: '' },
      ),
    ).rejects.toBeInstanceOf(TenantScopeViolation);
  });

  it('rejects a whitespace tenantId param', async () => {
    const reader = fakeReader();
    const client = createTenantScopedCypher({ reader });
    await expect(
      client.readScoped(
        'MATCH (p:Property {_tenantId: $tenantId}) RETURN p',
        { tenantId: '   ' },
      ),
    ).rejects.toBeInstanceOf(TenantScopeViolation);
  });

  it('passes extra caller-supplied params through to the reader', async () => {
    const reader = fakeReader();
    const client = createTenantScopedCypher({ reader });
    await client.readScoped(
      'MATCH (p:Property {_tenantId: $tenantId, status: $status}) RETURN p',
      { tenantId: 'tenant-1', status: 'active' },
    );
    expect(reader.calls[0]!.params.status).toBe('active');
  });

  it('strict:false allows tenant-less queries but still requires tenantId param (defence in depth)', async () => {
    const reader = fakeReader();
    const client = createTenantScopedCypher({ reader, strict: false });
    await expect(
      client.readScoped('MATCH (p:Property) RETURN p', { tenantId: 'tenant-1' }),
    ).resolves.toEqual([]);
    await expect(
      client.readScoped('MATCH (p:Property) RETURN p', {
        tenantId: '',
      }),
    ).rejects.toBeInstanceOf(TenantScopeViolation);
  });
});

describe('createTenantScopedCypher — writeScoped', () => {
  it('delegates to the underlying writer when query is scoped', async () => {
    const reader = fakeReader();
    const writer = fakeWriter();
    const client = createTenantScopedCypher({ reader, writer });
    await client.writeScoped(
      'MERGE (p:Property {_tenantId: $tenantId, _id: $id}) SET p.name = $name',
      { tenantId: 'tenant-1', id: 'p-1', name: 'Acme Block' },
    );
    expect(writer.calls.length).toBe(1);
  });

  it('rejects when no writer is configured', async () => {
    const reader = fakeReader();
    const client = createTenantScopedCypher({ reader });
    await expect(
      client.writeScoped(
        'MERGE (p:Property {_tenantId: $tenantId})',
        { tenantId: 'tenant-1' },
      ),
    ).rejects.toBeInstanceOf(TenantScopeViolation);
  });

  it('rejects unsafe writes that would cross tenants', async () => {
    const reader = fakeReader();
    const writer = fakeWriter();
    const client = createTenantScopedCypher({ reader, writer });
    await expect(
      client.writeScoped(
        'MATCH (p:Property) DETACH DELETE p',
        { tenantId: 'tenant-1' },
      ),
    ).rejects.toBeInstanceOf(TenantScopeViolation);
    expect(writer.calls.length).toBe(0);
  });
});

describe('Cross-tenant leak prevention (regression for Gap D)', () => {
  it('refuses a query that forgot the tenant gate', async () => {
    const reader = fakeReader();
    const client = createTenantScopedCypher({ reader });
    // This is the EXACT footgun the helper exists to prevent:
    // a future tool author types `MATCH (n) WHERE n.id = $id` and
    // omits the tenant gate. The wrapper must refuse.
    await expect(
      client.readScoped(
        'MATCH (n) WHERE n._id = $id RETURN n',
        { tenantId: 'tenant-1', id: 'leaked' },
      ),
    ).rejects.toBeInstanceOf(TenantScopeViolation);
    expect(reader.calls.length).toBe(0);
  });
});

describe('scopeNodePattern', () => {
  it('adds the tenant gate to a bag-less node pattern', () => {
    expect(scopeNodePattern('(p:Property)')).toBe('(p:Property {_tenantId: $tenantId})');
  });

  it('adds the tenant gate to a node pattern that already has a bag', () => {
    expect(scopeNodePattern('(p:Property {status: "active"})')).toBe(
      '(p:Property {_tenantId: $tenantId, status: "active"})',
    );
  });

  it('leaves an already-scoped pattern alone', () => {
    const already = '(p:Property {_tenantId: $tenantId})';
    expect(scopeNodePattern(already)).toBe(already);
  });

  it('returns non-node patterns unchanged', () => {
    expect(scopeNodePattern('-->')).toBe('-->');
  });
});

/**
 * M5 closure (round-3 audit): scopeAllNodePatterns must rewrite EVERY
 * node in a Cypher fragment, not just the first / outermost one. Real
 * Cypher patterns are usually chains like `(a)-[r]->(b)`; the previous
 * helper required the caller to apply the rewrite to each side, which
 * was easy to forget.
 */
describe('scopeAllNodePatterns (M5)', () => {
  it('rewrites both ends of a binary relationship', () => {
    const out = scopeAllNodePatterns(
      'MATCH (a:Property)-[r:OWNS]->(b:Owner) RETURN a, b',
    );
    expect(out).toBe(
      'MATCH (a:Property {_tenantId: $tenantId})-[r:OWNS]->(b:Owner {_tenantId: $tenantId}) RETURN a, b',
    );
  });

  it('rewrites every hop in a longer chain', () => {
    const out = scopeAllNodePatterns(
      'MATCH (a)-[:R1]->(b)-[:R2]->(c) RETURN c',
    );
    expect(out).toBe(
      'MATCH (a {_tenantId: $tenantId})-[:R1]->(b {_tenantId: $tenantId})-[:R2]->(c {_tenantId: $tenantId}) RETURN c',
    );
  });

  it('preserves existing property bags', () => {
    const out = scopeAllNodePatterns(
      'MATCH (a:Property {status: "active"})-[r:OWNS]->(b:Owner)',
    );
    expect(out).toBe(
      'MATCH (a:Property {_tenantId: $tenantId, status: "active"})-[r:OWNS]->(b:Owner {_tenantId: $tenantId})',
    );
  });

  it('leaves already-scoped patterns alone', () => {
    const input = 'MATCH (a {_tenantId: $tenantId})-[:R]->(b)';
    const out = scopeAllNodePatterns(input);
    expect(out).toBe(
      'MATCH (a {_tenantId: $tenantId})-[:R]->(b {_tenantId: $tenantId})',
    );
  });

  it('does NOT confuse function calls with node patterns', () => {
    // `count(a)` is a function call — must not be rewritten.
    const out = scopeAllNodePatterns(
      'MATCH (a:Property) RETURN count(a) AS n',
    );
    expect(out).toBe(
      'MATCH (a:Property {_tenantId: $tenantId}) RETURN count(a) AS n',
    );
  });

  it('does NOT corrupt parens inside string literals', () => {
    const input = 'MATCH (a:Property) WHERE a.name = "(foo)" RETURN a';
    const out = scopeAllNodePatterns(input);
    expect(out).toBe(
      'MATCH (a:Property {_tenantId: $tenantId}) WHERE a.name = "(foo)" RETURN a',
    );
  });

  it('returns input unchanged when no node patterns are present', () => {
    const input = 'RETURN $tenantId AS x';
    expect(scopeAllNodePatterns(input)).toBe(input);
  });
});
