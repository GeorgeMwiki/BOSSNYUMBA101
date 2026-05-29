import { describe, expect, it } from 'vitest';
import { buildProgram } from '../src/cli-program.js';
import { generateCompletion } from '../src/commands/completion.js';
import { createLogger } from '../src/logger.js';

const silentLogger = createLogger({ json: true, noColor: true });

describe('completion script generators', () => {
  it('bash script lists top-level verbs', () => {
    const program = buildProgram({ logger: silentLogger });
    const script = generateCompletion('bash', program);
    expect(script).toContain('_bossnyumba_completion');
    expect(script).toContain('complete -F');
    expect(script).toContain('login');
    expect(script).toContain('leases');
    expect(script).toContain('watch');
    expect(script).toContain('agent');
  });

  it('zsh script defines _bossnyumba + compdef', () => {
    const program = buildProgram({ logger: silentLogger });
    const script = generateCompletion('zsh', program);
    expect(script).toMatch(/#compdef bossnyumba/);
    expect(script).toContain('_bossnyumba');
    expect(script).toContain('login');
  });

  it('fish script defines a completion function', () => {
    const program = buildProgram({ logger: silentLogger });
    const script = generateCompletion('fish', program);
    expect(script).toContain('__bossnyumba_complete');
    expect(script).toContain('login');
  });
});
