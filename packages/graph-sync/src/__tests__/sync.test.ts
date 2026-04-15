/**
 * Baseline tests for @bossnyumba/graph-sync.
 *
 * A live Neo4j driver is NOT required for these tests. We cover:
 *   1. The Neo4jConfigSchema zod parser — defaults, validation, overrides.
 *   2. The CPG schema constant arrays — label/relationship-type composition.
 *   3. The BaseNodeProperties shape via a hand-rolled example.
 *   4. applyConstraintsAndIndexes export presence.
 *
 * Anything that would open a bolt:// connection (Neo4jClient constructor,
 * createNeo4jClient, getDefaultNeo4jClient) is intentionally NOT invoked.
 */

import { describe, it, expect } from 'vitest';
import {
  Neo4jConfigSchema,
  ALL_NODE_LABELS,
  ORG_LABELS,
  PROPERTY_LABELS,
  PEOPLE_LABELS,
  CONTRACT_LABELS,
  OPS_LABELS,
  FINANCE_LABELS,
  LEGAL_LABELS,
  MARKET_LABELS,
  TIMELINE_LABELS,
  ALL_RELATIONSHIP_TYPES,
  ORG_RELATIONSHIPS,
  PROPERTY_HIERARCHY_RELATIONSHIPS,
  applyConstraintsAndIndexes,
  UNIQUENESS_CONSTRAINTS,
  PERFORMANCE_INDEXES,
  FULLTEXT_INDEXES,
  type BaseNodeProperties,
} from '../index.js';

describe('Neo4jConfigSchema', () => {
  it('applies sensible defaults when given an empty object', () => {
    const parsed = Neo4jConfigSchema.parse({});
    expect(parsed.uri).toBe('bolt://localhost:7687');
    expect(parsed.username).toBe('neo4j');
    expect(parsed.database).toBe('neo4j');
    expect(parsed.maxConnectionPoolSize).toBe(50);
    expect(parsed.encrypted).toBe(false);
  });

  it('accepts overrides and keeps numeric fields as numbers', () => {
    const parsed = Neo4jConfigSchema.parse({
      uri: 'neo4j+s://prod.example.com:7687',
      username: 'app',
      password: 'secret',
      maxConnectionPoolSize: 100,
      encrypted: true,
    });
    expect(parsed.uri).toBe('neo4j+s://prod.example.com:7687');
    expect(parsed.encrypted).toBe(true);
    expect(parsed.maxConnectionPoolSize).toBe(100);
  });

  it('rejects wrongly-typed fields', () => {
    const result = Neo4jConfigSchema.safeParse({
      // maxConnectionPoolSize must be a number
      maxConnectionPoolSize: 'fifty',
    });
    expect(result.success).toBe(false);
  });
});

describe('CPG node labels', () => {
  it('ALL_NODE_LABELS is the concatenation of every label group', () => {
    const expectedLength =
      ORG_LABELS.length +
      PROPERTY_LABELS.length +
      PEOPLE_LABELS.length +
      CONTRACT_LABELS.length +
      OPS_LABELS.length +
      FINANCE_LABELS.length +
      LEGAL_LABELS.length +
      MARKET_LABELS.length +
      TIMELINE_LABELS.length;
    expect(ALL_NODE_LABELS).toHaveLength(expectedLength);
  });

  it('contains well-known PascalCase labels', () => {
    expect(ALL_NODE_LABELS).toContain('Property');
    expect(ALL_NODE_LABELS).toContain('Unit');
    expect(ALL_NODE_LABELS).toContain('Lease');
    expect(ALL_NODE_LABELS).toContain('Invoice');
    expect(ALL_NODE_LABELS).toContain('WorkOrder');
  });

  it('contains no duplicate labels', () => {
    const unique = new Set(ALL_NODE_LABELS);
    expect(unique.size).toBe(ALL_NODE_LABELS.length);
  });
});

describe('CPG relationship types', () => {
  it('ALL_RELATIONSHIP_TYPES includes the org & hierarchy subsets', () => {
    for (const r of ORG_RELATIONSHIPS) {
      expect(ALL_RELATIONSHIP_TYPES).toContain(r);
    }
    for (const r of PROPERTY_HIERARCHY_RELATIONSHIPS) {
      expect(ALL_RELATIONSHIP_TYPES).toContain(r);
    }
  });

  it('uses verb-style UPPER_SNAKE_CASE names', () => {
    for (const r of ALL_RELATIONSHIP_TYPES) {
      expect(r).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});

describe('Constraint / index catalogues', () => {
  it('UNIQUENESS_CONSTRAINTS / PERFORMANCE_INDEXES / FULLTEXT_INDEXES are non-empty arrays', () => {
    expect(Array.isArray(UNIQUENESS_CONSTRAINTS)).toBe(true);
    expect(UNIQUENESS_CONSTRAINTS.length).toBeGreaterThan(0);
    expect(Array.isArray(PERFORMANCE_INDEXES)).toBe(true);
    expect(Array.isArray(FULLTEXT_INDEXES)).toBe(true);
  });

  it('exposes applyConstraintsAndIndexes as a callable', () => {
    expect(typeof applyConstraintsAndIndexes).toBe('function');
  });

  it('every uniqueness entry references an existing node label', () => {
    const known = new Set<string>(ALL_NODE_LABELS);
    for (const c of UNIQUENESS_CONSTRAINTS) {
      expect(known.has(c.label)).toBe(true);
      expect(c.properties.length).toBeGreaterThan(0);
    }
  });
});

describe('BaseNodeProperties shape', () => {
  it('accepts the documented _-prefixed bookkeeping fields', () => {
    // Compile-time check: assigning a concrete object to the type surfaces
    // missing fields. Kept as a runtime expect() to ensure vitest counts it.
    const node: BaseNodeProperties = {
      _id: 'prop-1',
      _tenantId: 'tenant-a',
      _syncedAt: '2026-04-15T00:00:00Z',
      _sourceTable: 'properties',
      _version: 1,
    };
    expect(node._id).toBe('prop-1');
    expect(node._tenantId).toBe('tenant-a');
    expect(node._version).toBe(1);
  });
});
