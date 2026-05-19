import { describe, expect, it } from 'vitest';
import { createDraft, type DraftArtifact, type DraftStrategy } from '../primitives/draft.js';
import { makeCtx } from './_helpers.js';

interface TestInput {
  readonly body: string;
}

const stubDraft: DraftStrategy<TestInput, DraftArtifact> = {
  async draft({ input }) {
    return {
      subject: `Re: ${input.body.slice(0, 20)}`,
      body: input.body,
      format: 'plain',
      languageTag: 'en',
      piiRedacted: true,
    };
  },
};

describe('createDraft', () => {
  it('emits a draft status entry in any mode (never sealed/sent)', async () => {
    const { ctx, recorder } = makeCtx({ mode: 'auto' });
    const draft = createDraft({ name: 'd.basic', strategy: stubDraft });
    const r = await draft.run({
      input: { body: 'Hello world' },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.body).toBe('Hello world');
    expect(recorder.entries[0]!.status).not.toBe('sealed');
    expect(recorder.entries[0]!.status).toBe('draft');
    expect(recorder.entries[0]!.sideEffectCount).toBe(0);
  });

  it('rejects when body exceeds maxBodyLength', async () => {
    const long = 'x'.repeat(50);
    const { ctx, recorder } = makeCtx();
    const draft = createDraft({
      name: 'd.long',
      strategy: stubDraft,
      maxBodyLength: 10,
    });
    const r = await draft.run({
      input: { body: long },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(recorder.entries[0]!.status).toBe('rejected');
    expect(recorder.entries[0]!.summary).toMatch(/body \d+ > max \d+/);
    void r;
  });

  it('honors propose mode → status draft', async () => {
    const { ctx, recorder } = makeCtx({ mode: 'propose' });
    const draft = createDraft({ name: 'd.propose', strategy: stubDraft });
    await draft.run({ input: { body: 'x' }, inputTenantId: 'tenant-1', ctx });
    expect(recorder.entries[0]!.status).toBe('draft');
  });

  it('honors act-on-yes mode → status awaiting-owner', async () => {
    const { ctx, recorder } = makeCtx({ mode: 'act-on-yes' });
    const draft = createDraft({ name: 'd.ack', strategy: stubDraft });
    await draft.run({ input: { body: 'x' }, inputTenantId: 'tenant-1', ctx });
    expect(recorder.entries[0]!.status).toBe('awaiting-owner');
  });

  it('honors dry-run mode → status dry-run', async () => {
    const { ctx, recorder } = makeCtx({ mode: 'dry-run' });
    const draft = createDraft({ name: 'd.dry', strategy: stubDraft });
    await draft.run({ input: { body: 'x' }, inputTenantId: 'tenant-1', ctx });
    expect(recorder.entries[0]!.status).toBe('dry-run');
  });

  it('rejects cross-tenant input', async () => {
    const { ctx, recorder } = makeCtx({ tenantId: 'tenant-1' });
    const draft = createDraft({ name: 'd.scope', strategy: stubDraft });
    await draft.run({ input: { body: 'x' }, inputTenantId: 'tenant-other', ctx });
    expect(recorder.entries[0]!.status).toBe('rejected');
  });
});
