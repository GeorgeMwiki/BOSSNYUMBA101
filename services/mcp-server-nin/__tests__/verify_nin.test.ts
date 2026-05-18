import { describe, it, expect } from 'vitest';
import { verifyNinTool } from '../src/tools/verify_nin.js';
import { MockNinAdapter } from '../src/adapter.js';

describe('nin.verify_nin', () => {
  const deps = { nin: new MockNinAdapter() };

  it('declares the MCP-compatible tool descriptor', () => {
    expect(verifyNinTool.name).toBe('nin.verify_nin');
    expect(verifyNinTool.inputSchema.required).toContain('tenantId');
    expect(verifyNinTool.inputSchema.required).toContain('nin');
    expect(verifyNinTool.outputSchema.required).toContain('verified');
    expect(verifyNinTool.outputSchema.required).toContain('matchScore');
  });

  it('returns verified=true for a valid-shape NIN ending in an even digit', async () => {
    const result = await verifyNinTool.execute(
      { tenantId: 't1', nin: '12345678900' },
      deps,
    );
    expect(result.verified).toBe(true);
    expect(result.matchScore).toBeGreaterThanOrEqual(0.9);
    expect(result.referenceId).toMatch(/^nimc-mock-t1-/);
  });

  it('returns verified=false with reason for an odd-last-digit NIN', async () => {
    const result = await verifyNinTool.execute(
      { tenantId: 't1', nin: '12345678901' },
      deps,
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('biometric_mismatch');
  });

  it('returns verified=false with reason=invalid_shape for non-11-digit input', async () => {
    const result = await verifyNinTool.execute(
      { tenantId: 't1', nin: 'A12345B' },
      deps,
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toBe('invalid_shape');
  });

  it('throws on missing required input fields', async () => {
    await expect(
      verifyNinTool.execute({ tenantId: 't1' }, deps),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
