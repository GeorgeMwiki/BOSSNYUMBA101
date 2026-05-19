import { describe, expect, it } from 'vitest';
import { createFilesCitationsClient } from './files-client.js';
import type { FileId, TenantContext } from '../types.js';

const ctx: TenantContext = {
  tenantId: 'tnt-acme',
  principalId: 'usr-1',
  correlationId: 'corr-files',
};
const OTHER_CTX: TenantContext = {
  tenantId: 'tnt-other',
  principalId: 'usr-2',
  correlationId: 'corr-other',
};

describe('createFilesCitationsClient — upload', () => {
  it('uploads a PDF and returns a fileId', async () => {
    const client = createFilesCitationsClient();
    const id = await client.uploadFile({
      path: '/tmp/lease.pdf',
      mime: 'application/pdf',
      title: 'Lease v3',
      tenantContext: ctx,
    });
    expect(id.value).toMatch(/^file_/);
  });

  it('rejects unsupported MIME types', async () => {
    const client = createFilesCitationsClient();
    await expect(
      client.uploadFile({
        path: '/tmp/img.png',
        mime: 'image/png' as never,
        tenantContext: ctx,
      }),
    ).rejects.toThrow(/unsupported mime/i);
  });

  it('enforces 30MB max', async () => {
    const client = createFilesCitationsClient({
      fileSizeProbe: async () => 40 * 1024 * 1024,
    });
    await expect(
      client.uploadFile({
        path: '/tmp/big.pdf',
        mime: 'application/pdf',
        tenantContext: ctx,
      }),
    ).rejects.toThrow(/exceeds 30 mb/i);
  });

  it('delegates to anthropic SDK when injected', async () => {
    const client = createFilesCitationsClient({
      anthropicFilesUpload: async () => ({ fileId: 'file_sdk_xyz', sha256: 'abc' }),
    });
    const id = await client.uploadFile({
      path: '/tmp/x.pdf',
      mime: 'application/pdf',
      tenantContext: ctx,
    });
    expect(id.value).toBe('file_sdk_xyz');
  });
});

describe('createFilesCitationsClient — analyzeWithCitations', () => {
  it('returns citations with the answer', async () => {
    const client = createFilesCitationsClient();
    const id = await client.uploadFile({
      path: '/tmp/lease.pdf',
      mime: 'application/pdf',
      title: 'Aisha lease',
      tenantContext: ctx,
    });
    const ans = await client.analyzeWithCitations({
      fileIds: [id],
      prompt: 'When does the next rent review fall?',
      model: 'claude-opus-4-7',
      tenantContext: ctx,
    });
    expect(ans.citations).toHaveLength(1);
    expect(ans.citations[0]!.title).toBe('Aisha lease');
    expect(ans.citedTokenFreeBytes).toBeGreaterThan(0);
  });

  it('reports cited_text bytes as free (Citations API pricing)', async () => {
    const client = createFilesCitationsClient();
    const id = await client.uploadFile({
      path: '/tmp/sop.md',
      mime: 'text/markdown',
      tenantContext: ctx,
    });
    const ans = await client.analyzeWithCitations({
      fileIds: [id],
      prompt: 'What is the SOP?',
      model: 'claude-sonnet-4-6',
      tenantContext: ctx,
    });
    expect(ans.citedTokenFreeBytes).toBeGreaterThan(0);
  });

  it('rejects when no file ids supplied', async () => {
    const client = createFilesCitationsClient();
    await expect(
      client.analyzeWithCitations({
        fileIds: [],
        prompt: 'hi',
        model: 'claude-opus-4-7',
        tenantContext: ctx,
      }),
    ).rejects.toThrow(/at least one/i);
  });

  it('rejects > 20 files (anthropic per-conversation limit)', async () => {
    const client = createFilesCitationsClient();
    const fakeIds: ReadonlyArray<FileId> = Array.from({ length: 21 }, (_, i) => ({
      value: `file_x_${i}`,
    }));
    await expect(
      client.analyzeWithCitations({
        fileIds: fakeIds,
        prompt: 'x',
        model: 'claude-opus-4-7',
        tenantContext: ctx,
      }),
    ).rejects.toThrow(/too many files/i);
  });

  it('blocks cross-tenant file access (multi-tenant isolation)', async () => {
    const client = createFilesCitationsClient();
    const id = await client.uploadFile({
      path: '/tmp/secret.pdf',
      mime: 'application/pdf',
      tenantContext: ctx,
    });
    await expect(
      client.analyzeWithCitations({
        fileIds: [id],
        prompt: 'show me',
        model: 'claude-opus-4-7',
        tenantContext: OTHER_CTX,
      }),
    ).rejects.toThrow(/tenant isolation/i);
  });

  it('delegates to anthropic SDK when injected', async () => {
    const client = createFilesCitationsClient({
      anthropicMessagesWithCitations: async () => ({
        answer: 'sdk-answer',
        citations: [],
        citedTokenFreeBytes: 0,
      }),
    });
    const r = await client.analyzeWithCitations({
      fileIds: [{ value: 'file_sdk' }],
      prompt: 'sdk',
      model: 'claude-opus-4-7',
      tenantContext: ctx,
    });
    expect(r.answer).toBe('sdk-answer');
  });

  it('handles 8 doc-analysis scenarios (lease/contract/KRA/etc.)', async () => {
    const client = createFilesCitationsClient();
    const scenarios: ReadonlyArray<{
      path: string;
      mime: 'application/pdf' | 'text/markdown' | 'text/csv' | 'application/json';
      prompt: string;
    }> = [
      { path: 'lease.pdf', mime: 'application/pdf', prompt: 'parse the lease' },
      { path: 'vendor.pdf', mime: 'application/pdf', prompt: 'review vendor contract' },
      { path: 'kra.pdf', mime: 'application/pdf', prompt: 'interpret KRA notice' },
      { path: 'sop.md', mime: 'text/markdown', prompt: 'summarize the SOP' },
      { path: 'inventory.csv', mime: 'text/csv', prompt: 'list units' },
      { path: 'tax.json', mime: 'application/json', prompt: 'extract rates' },
      { path: 'statement.pdf', mime: 'application/pdf', prompt: 'reconcile statement' },
      { path: 'audit.md', mime: 'text/markdown', prompt: 'flag findings' },
    ];
    for (const s of scenarios) {
      const id = await client.uploadFile({
        path: `/tmp/${s.path}`,
        mime: s.mime,
        tenantContext: ctx,
      });
      const ans = await client.analyzeWithCitations({
        fileIds: [id],
        prompt: s.prompt,
        model: 'claude-sonnet-4-6',
        tenantContext: ctx,
      });
      expect(ans.citations).toHaveLength(1);
      expect(ans.answer).toContain(s.prompt);
    }
  });
});
