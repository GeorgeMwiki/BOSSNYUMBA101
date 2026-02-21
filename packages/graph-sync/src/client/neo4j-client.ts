/**
 * Neo4j Client — Connection management for the Canonical Property Graph
 *
 * Wraps the Neo4j JavaScript driver with:
 *  - Connection pooling
 *  - Health checks
 *  - Tenant-scoped session factory
 *  - Graceful shutdown
 */

import neo4j, { Driver, Session, SessionMode } from 'neo4j-driver';
import { z } from 'zod';

// ─── Configuration ───────────────────────────────────────────────────────────

export const Neo4jConfigSchema = z.object({
  uri: z.string().default('bolt://localhost:7687'),
  username: z.string().default('neo4j'),
  password: z.string().default('bossnyumba_graph_dev'),
  database: z.string().default('neo4j'),
  maxConnectionPoolSize: z.number().default(50),
  connectionAcquisitionTimeoutMs: z.number().default(30000),
  connectionTimeoutMs: z.number().default(10000),
  maxTransactionRetryTimeMs: z.number().default(30000),
  encrypted: z.boolean().default(false),
});

export type Neo4jConfig = z.infer<typeof Neo4jConfigSchema>;

// ─── Client Class ────────────────────────────────────────────────────────────

export class Neo4jClient {
  private driver: Driver;
  private config: Neo4jConfig;
  private isConnected = false;

  constructor(config: Partial<Neo4jConfig> = {}) {
    this.config = Neo4jConfigSchema.parse(config);

    this.driver = neo4j.driver(
      this.config.uri,
      neo4j.auth.basic(this.config.username, this.config.password),
      {
        maxConnectionPoolSize: this.config.maxConnectionPoolSize,
        connectionAcquisitionTimeout: this.config.connectionAcquisitionTimeoutMs,
        connectionTimeout: this.config.connectionTimeoutMs,
        maxTransactionRetryTime: this.config.maxTransactionRetryTimeMs,
        encrypted: this.config.encrypted ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF',
      }
    );
  }

  /**
   * Verify connectivity to Neo4j
   */
  async verifyConnectivity(): Promise<boolean> {
    try {
      await this.driver.verifyConnectivity();
      this.isConnected = true;
      return true;
    } catch {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Health check with server info
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    serverVersion?: string;
    database?: string;
    error?: string;
  }> {
    try {
      const serverInfo = await this.driver.getServerInfo();
      return {
        healthy: true,
        serverVersion: serverInfo.protocolVersion?.toString(),
        database: this.config.database,
      };
    } catch (err) {
      return {
        healthy: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Get a read session (for queries)
   */
  readSession(database?: string): Session {
    return this.driver.session({
      defaultAccessMode: neo4j.session.READ,
      database: database ?? this.config.database,
    });
  }

  /**
   * Get a write session (for mutations)
   */
  writeSession(database?: string): Session {
    return this.driver.session({
      defaultAccessMode: neo4j.session.WRITE,
      database: database ?? this.config.database,
    });
  }

  /**
   * Execute a read query with automatic session management
   */
  async readQuery<T = Record<string, unknown>>(
    cypher: string,
    params: Record<string, unknown> = {},
    database?: string
  ): Promise<T[]> {
    const session = this.readSession(database);
    try {
      const result = await session.run(cypher, params);
      return result.records.map(record => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a write query with automatic session management
   */
  async writeQuery<T = Record<string, unknown>>(
    cypher: string,
    params: Record<string, unknown> = {},
    database?: string
  ): Promise<T[]> {
    const session = this.writeSession(database);
    try {
      const result = await session.run(cypher, params);
      return result.records.map(record => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a write transaction (with retry logic)
   */
  async writeTransaction<T>(
    work: (tx: neo4j.Transaction) => Promise<T>,
    database?: string
  ): Promise<T> {
    const session = this.writeSession(database);
    try {
      return await session.executeWrite(work);
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a read transaction (with retry logic)
   */
  async readTransaction<T>(
    work: (tx: neo4j.Transaction) => Promise<T>,
    database?: string
  ): Promise<T> {
    const session = this.readSession(database);
    try {
      return await session.executeRead(work);
    } finally {
      await session.close();
    }
  }

  /**
   * Get the underlying driver (for advanced use cases)
   */
  getDriver(): Driver {
    return this.driver;
  }

  /**
   * Check if client is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    await this.driver.close();
    this.isConnected = false;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

let defaultClient: Neo4jClient | null = null;

/**
 * Create a Neo4j client from environment variables or explicit config
 */
export function createNeo4jClient(config?: Partial<Neo4jConfig>): Neo4jClient {
  const envConfig: Partial<Neo4jConfig> = {
    uri: process.env.NEO4J_URI,
    username: process.env.NEO4J_USER,
    password: process.env.NEO4J_PASSWORD,
    database: process.env.NEO4J_DATABASE,
  };

  return new Neo4jClient({ ...envConfig, ...config });
}

/**
 * Get or create the default Neo4j client (singleton)
 */
export function getDefaultNeo4jClient(): Neo4jClient {
  if (!defaultClient) {
    defaultClient = createNeo4jClient();
  }
  return defaultClient;
}

/**
 * Close the default client (for graceful shutdown)
 */
export async function closeDefaultNeo4jClient(): Promise<void> {
  if (defaultClient) {
    await defaultClient.close();
    defaultClient = null;
  }
}
