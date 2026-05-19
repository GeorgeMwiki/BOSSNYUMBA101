/**
 * Memory tool + Managed Agents adapter.
 *
 * Two interchangeable backends:
 *   - "managed-agents" — Anthropic-hosted `/mnt/memory/` filesystem in
 *     Managed Agents containers (workspace-scoped).
 *   - "sessionstore" — our own per-tenant durable store (for self-hosted
 *     deployments where Managed Agents isn't available).
 *
 * Selected by `MEMORY_BACKEND` env variable (defaults to sessionstore in
 * unit tests).
 *
 * Per-tenant memory directory: `/mnt/memory/<tenantId>/<scope>/<note>.md`
 *
 * Closes L2 #7.
 */

import type { MemoryAdapter, MemoryBackend } from '../types.js';
import { resolveMemoryDir, resolveMemoryPath } from './memory-paths.js';

const MANAGED_AGENTS_ROOT = '/mnt/memory';
const SESSIONSTORE_ROOT = 'sessionstore://memory';

export interface MemoryAdapterFactoryDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Hook to talk to Anthropic Managed Agents filesystem in prod. */
  readonly managedAgentsFs?: ManagedAgentsFsClient;
  /** Hook to talk to our own SessionStore in self-hosted mode. */
  readonly sessionStore?: SessionStoreClient;
}

export interface ManagedAgentsFsClient {
  read(absPath: string): Promise<string | null>;
  write(absPath: string, content: string): Promise<void>;
  remove(absPath: string): Promise<void>;
  rename(fromAbs: string, toAbs: string): Promise<void>;
  list(absDir: string): Promise<ReadonlyArray<string>>;
}

export interface SessionStoreClient {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  rename(fromKey: string, toKey: string): Promise<void>;
  list(prefix: string): Promise<ReadonlyArray<string>>;
}

export function pickBackend(env: Readonly<Record<string, string | undefined>>): MemoryBackend {
  const v = (env['MEMORY_BACKEND'] ?? 'sessionstore').toLowerCase();
  if (v === 'managed-agents' || v === 'sessionstore') {
    return v;
  }
  throw new Error(`Unknown MEMORY_BACKEND=${v}`);
}

export function createMemoryAdapter(
  deps: MemoryAdapterFactoryDeps = {},
): MemoryAdapter {
  const env = deps.env ?? readEnv();
  const backend = pickBackend(env);

  const rootPrefix =
    backend === 'managed-agents' ? MANAGED_AGENTS_ROOT : SESSIONSTORE_ROOT;

  // Use synthetic in-memory backend for tests by default.
  const mem = new Map<string, string>();

  const managedFs: ManagedAgentsFsClient =
    deps.managedAgentsFs ?? {
      async read(p) { return mem.get(p) ?? null; },
      async write(p, c) { mem.set(p, c); },
      async remove(p) { mem.delete(p); },
      async rename(from, to) {
        const v = mem.get(from);
        if (v === undefined) throw new Error(`No such file ${from}`);
        mem.delete(from);
        mem.set(to, v);
      },
      async list(dir) {
        const prefix = dir.endsWith('/') ? dir : `${dir}/`;
        return Array.from(mem.keys())
          .filter((k) => k.startsWith(prefix))
          .map((k) => k.slice(prefix.length));
      },
    };

  const sessionStore: SessionStoreClient =
    deps.sessionStore ?? {
      async get(k) { return mem.get(k) ?? null; },
      async put(k, v) { mem.set(k, v); },
      async delete(k) { mem.delete(k); },
      async rename(from, to) {
        const v = mem.get(from);
        if (v === undefined) throw new Error(`No such key ${from}`);
        mem.delete(from);
        mem.set(to, v);
      },
      async list(prefix) {
        return Array.from(mem.keys()).filter((k) => k.startsWith(prefix));
      },
    };

  return {
    backend,
    async view(tenantId, path) {
      const abs = resolveMemoryPath(rootPrefix, tenantId, path);
      return backend === 'managed-agents'
        ? managedFs.read(abs)
        : sessionStore.get(abs);
    },
    async create(tenantId, path, content) {
      const abs = resolveMemoryPath(rootPrefix, tenantId, path);
      if (backend === 'managed-agents') {
        await managedFs.write(abs, content);
      } else {
        await sessionStore.put(abs, content);
      }
    },
    async strReplace(tenantId, path, oldStr, newStr) {
      const abs = resolveMemoryPath(rootPrefix, tenantId, path);
      const current =
        backend === 'managed-agents'
          ? await managedFs.read(abs)
          : await sessionStore.get(abs);
      if (current === null) {
        throw new Error(`No memory note at ${abs}`);
      }
      if (!current.includes(oldStr)) {
        throw new Error(`oldStr not found in ${abs}`);
      }
      const next = current.replace(oldStr, newStr);
      if (backend === 'managed-agents') {
        await managedFs.write(abs, next);
      } else {
        await sessionStore.put(abs, next);
      }
    },
    async insert(tenantId, path, line, content) {
      const abs = resolveMemoryPath(rootPrefix, tenantId, path);
      const current =
        backend === 'managed-agents'
          ? await managedFs.read(abs)
          : await sessionStore.get(abs);
      const lines = current === null ? [] : current.split('\n');
      const insertAt = Math.max(0, Math.min(line, lines.length));
      const next = [
        ...lines.slice(0, insertAt),
        content,
        ...lines.slice(insertAt),
      ].join('\n');
      if (backend === 'managed-agents') {
        await managedFs.write(abs, next);
      } else {
        await sessionStore.put(abs, next);
      }
    },
    async delete(tenantId, path) {
      const abs = resolveMemoryPath(rootPrefix, tenantId, path);
      if (backend === 'managed-agents') {
        await managedFs.remove(abs);
      } else {
        await sessionStore.delete(abs);
      }
    },
    async rename(tenantId, fromPath, toPath) {
      const fromAbs = resolveMemoryPath(rootPrefix, tenantId, fromPath);
      const toAbs = resolveMemoryPath(rootPrefix, tenantId, toPath);
      if (backend === 'managed-agents') {
        await managedFs.rename(fromAbs, toAbs);
      } else {
        await sessionStore.rename(fromAbs, toAbs);
      }
    },
    async list(tenantId, dirPath) {
      // Resolve a directory — if dirPath empty, the tenant root.
      const absDir =
        dirPath.trim() === ''
          ? resolveMemoryDir(rootPrefix, tenantId, '')
          : `${resolveMemoryDir(rootPrefix, tenantId, '')}/${dirPath.replace(/^\//, '')}`;
      return backend === 'managed-agents'
        ? managedFs.list(absDir)
        : sessionStore.list(absDir);
    },
  };
}

function readEnv(): Readonly<Record<string, string | undefined>> {
  if (typeof process !== 'undefined' && process.env) {
    return process.env as Readonly<Record<string, string | undefined>>;
  }
  return {};
}
