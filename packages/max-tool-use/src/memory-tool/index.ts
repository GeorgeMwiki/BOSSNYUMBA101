/**
 * Memory tool + Managed Agents — public surface.
 *
 * Closes L2 #7.
 */

export {
  createMemoryAdapter,
  pickBackend,
  type MemoryAdapterFactoryDeps,
  type ManagedAgentsFsClient,
  type SessionStoreClient,
} from './memory-adapter.js';

export {
  resolveMemoryPath,
  resolveMemoryDir,
  MemoryPathError,
  SUPPORTED_SCOPES,
  type MemoryScope,
} from './memory-paths.js';
