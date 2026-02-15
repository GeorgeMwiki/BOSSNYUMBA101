/**
 * Local Storage Provider
 * For development - stores files in local filesystem with tenant isolation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TenantId } from '@bossnyumba/domain-models';
import type { StorageProvider, UploadInput, UploadResult, SignedUrlOptions } from './storage-provider.interface.js';

/** Default base path for local storage */
const DEFAULT_BASE_PATH = './storage/documents';

export interface LocalStorageProviderOptions {
  readonly basePath?: string;
}

export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string;

  constructor(options: LocalStorageProviderOptions = {}) {
    this.basePath = options.basePath ?? path.resolve(process.cwd(), DEFAULT_BASE_PATH);
  }

  private getTenantPath(tenantId: TenantId): string {
    return path.join(this.basePath, String(tenantId));
  }

  private getFullPath(tenantId: TenantId, key: string): string {
    return path.join(this.getTenantPath(tenantId), key);
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    const fullPath = this.getFullPath(input.tenantId, input.key);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = input.content instanceof Blob
      ? Buffer.from(await input.content.arrayBuffer())
      : (input.content as Buffer);

    fs.writeFileSync(fullPath, content);

    const url = `/documents/${input.tenantId}/${input.key}`;
    return { key: input.key, url };
  }

  async getSignedUrl(tenantId: TenantId, key: string, _options: SignedUrlOptions): Promise<string> {
    const fullPath = this.getFullPath(tenantId, key);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${key}`);
    }
    return `/documents/${tenantId}/${key}`;
  }

  async delete(tenantId: TenantId, key: string): Promise<void> {
    const fullPath = this.getFullPath(tenantId, key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async exists(tenantId: TenantId, key: string): Promise<boolean> {
    const fullPath = this.getFullPath(tenantId, key);
    return fs.existsSync(fullPath);
  }

  getBaseUrl(tenantId: TenantId): string {
    return `/documents/${tenantId}`;
  }
}
