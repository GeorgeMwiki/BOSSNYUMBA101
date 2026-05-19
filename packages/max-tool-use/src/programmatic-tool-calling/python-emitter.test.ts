import { describe, expect, it } from 'vitest';
import { countToolImports, emitPtcProgram } from './python-emitter.js';

describe('python-emitter', () => {
  it('emits a runnable Python program for a single tool', () => {
    const program = emitPtcProgram('list overdue tenants', ['tenant_ledger']);
    expect(program).toContain('async def main()');
    expect(program).toContain('tenant_ledger,');
    expect(program).toContain('asyncio.gather(');
  });

  it('snake-cases CamelCase tool names', () => {
    const program = emitPtcProgram('demo', ['VendorLookupTool']);
    expect(program).toContain('vendor_lookup_tool,');
  });

  it('snake-cases kebab-case tool names', () => {
    const program = emitPtcProgram('demo', ['fetch-payment-status']);
    expect(program).toContain('fetch_payment_status,');
  });

  it('counts imports back from the emitted program', () => {
    const program = emitPtcProgram('multi', ['a_tool', 'b_tool', 'c_tool']);
    expect(countToolImports(program)).toBe(3);
  });

  it('refuses empty tool list', () => {
    expect(() => emitPtcProgram('demo', [])).toThrow(/at least one/i);
  });

  it('escapes triple-quotes in the task to keep the docstring valid', () => {
    const program = emitPtcProgram('mention """ trips', ['x']);
    expect(program).not.toContain('mention """ trips');
    expect(program).toContain('mention \\"\\"\\" trips');
  });

  it('accepts DomainToolDefinition objects as input', () => {
    const program = emitPtcProgram('demo', [
      {
        name: 'kra_filing',
        description: 'file monthly tot',
        input_schema: { type: 'object', properties: {} },
      },
    ]);
    expect(program).toContain('kra_filing,');
  });

  it('renders fan-out call site with step indices', () => {
    const program = emitPtcProgram('demo', ['tool_a', 'tool_b']);
    expect(program).toContain('tool_a(step=0)');
    expect(program).toContain('tool_b(step=1)');
  });
});
