import { describe, expect, it } from 'vitest';
import {
  MemoryPathError,
  SUPPORTED_SCOPES,
  resolveMemoryDir,
  resolveMemoryPath,
} from './memory-paths.js';

describe('resolveMemoryPath', () => {
  it('builds /mnt/memory/<tenant>/<scope>/<note>.md', () => {
    const p = resolveMemoryPath(
      '/mnt/memory',
      'tnt-001',
      'playbooks/eviction.md',
    );
    expect(p).toBe('/mnt/memory/tnt-001/playbooks/eviction.md');
  });

  it('rejects path traversal with ..', () => {
    expect(() =>
      resolveMemoryPath('/mnt/memory', 'tnt-001', '../etc/passwd'),
    ).toThrow(MemoryPathError);
  });

  it('rejects path traversal via .', () => {
    expect(() =>
      resolveMemoryPath('/mnt/memory', 'tnt-001', './x.md'),
    ).toThrow(MemoryPathError);
  });

  it('rejects empty paths', () => {
    expect(() => resolveMemoryPath('/mnt/memory', 'tnt-001', '')).toThrow(
      MemoryPathError,
    );
  });

  it('rejects unsafe tenantId', () => {
    expect(() =>
      resolveMemoryPath('/mnt/memory', 'tnt with spaces', 'x.md'),
    ).toThrow(MemoryPathError);
  });

  it('rejects unsafe path segment characters', () => {
    expect(() =>
      resolveMemoryPath('/mnt/memory', 'tnt-001', 'bad/path with space'),
    ).toThrow(MemoryPathError);
  });
});

describe('resolveMemoryDir', () => {
  it('builds /mnt/memory/<tenant> when scope is empty', () => {
    expect(resolveMemoryDir('/mnt/memory', 'tnt-001', '')).toBe(
      '/mnt/memory/tnt-001',
    );
  });

  it('builds /mnt/memory/<tenant>/<scope> for valid scopes', () => {
    expect(resolveMemoryDir('/mnt/memory', 'tnt-001', 'vendors')).toBe(
      '/mnt/memory/tnt-001/vendors',
    );
  });

  it('rejects unknown scope', () => {
    expect(() =>
      resolveMemoryDir('/mnt/memory', 'tnt-001', 'evil' as never),
    ).toThrow(MemoryPathError);
  });
});

describe('SUPPORTED_SCOPES', () => {
  it('contains the five canonical scopes', () => {
    expect([...SUPPORTED_SCOPES]).toEqual([
      'playbooks',
      'vendors',
      'tenants',
      'properties',
      'learned-heuristics',
    ]);
  });
});
