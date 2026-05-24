/**
 * Typst renderer.
 *
 * Typst is the modern LaTeX alternative — Rust-based, 10-100× faster
 * compile, single-pass reference resolution. The research report
 * picks it for court-formatted legal docs (eviction notice, rent
 * increase notice, demand letter) where speed + clean error messages
 * matter and brand-template-DOCX is overkill.
 *
 * The real renderer spawns the `typst` binary (path from
 * `TYPST_BINARY`) — writes the template + data context to a temp dir,
 * runs `typst compile`, reads back the PDF. Tests use the
 * deterministic stub renderer to avoid the binary dependency.
 *
 * Refs:
 *   - https://typst.app/docs/
 *   - https://github.com/typst/typst
 *   - .audit/litfin-sota-2026-05-23/19-document-generation.md §4 LaTeX/Typst
 */

import type {
  Renderer,
  RendererInput,
  RendererOutput,
} from '../types.js';
import { stubRender } from './carbone-renderer.js';

/** Function the real renderer uses to spawn `typst compile`. Pluggable for tests. */
export type TypstSpawnFn = (
  binary: string,
  args: ReadonlyArray<string>,
  cwd: string,
) => Promise<{ stdout: Uint8Array; stderr: string; exitCode: number }>;

export interface TypstRendererOptions {
  /** Absolute path or PATH-resolvable name of the typst binary. Stub-mode if unset. */
  readonly typstBinary?: string;
  /** Temp directory for template + compiled output. Defaults to `/tmp`. */
  readonly tempDir?: string;
  /** Spawn implementation. Defaults to internal `node:child_process` wrapper. */
  readonly spawn?: TypstSpawnFn;
}

export class TypstRenderer implements Renderer {
  public readonly id = 'typst';
  private readonly options: TypstRendererOptions;

  constructor(options: TypstRendererOptions = {}) {
    this.options = options;
  }

  /** True when no typst binary is configured. */
  public isStub(): boolean {
    return !this.options.typstBinary;
  }

  async render<TData>(input: RendererInput<TData>): Promise<RendererOutput> {
    if (this.isStub()) {
      return stubRender(this.id, input);
    }
    return this.realRender(input);
  }

  private async realRender<TData>(
    input: RendererInput<TData>,
  ): Promise<RendererOutput> {
    if (input.format !== 'pdf') {
      throw new Error(
        `TypstRenderer only emits PDF; requested format=${input.format}`,
      );
    }

    const binary = this.options.typstBinary!;
    const tempDir = this.options.tempDir ?? '/tmp';
    const spawn = this.options.spawn ?? defaultSpawn;

    // The template ref names a `.typ` file already materialised in the
    // bundled template directory (or a tenant override path). We pass
    // it through stdin via `--input` so the data is JSON-accessible
    // inside the template as `sys.inputs.data`.
    const args = [
      'compile',
      input.templateRef,
      '-',
      '--input',
      `data=${JSON.stringify(input.data)}`,
    ];

    const result = await spawn(binary, args, tempDir);
    if (result.exitCode !== 0) {
      throw new Error(`typst compile failed (exit ${result.exitCode}): ${result.stderr}`);
    }

    return {
      buffer: result.stdout,
      mimeType: 'application/pdf',
    };
  }
}

/**
 * Default child_process-based spawn. Imported lazily so the bundle
 * stays tree-shakable and tests never accidentally exec real binaries.
 */
async function defaultSpawn(
  binary: string,
  args: ReadonlyArray<string>,
  cwd: string,
): Promise<{ stdout: Uint8Array; stderr: string; exitCode: number }> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn(binary, [...args], { cwd });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: string[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({
        stdout: new Uint8Array(Buffer.concat(stdoutChunks)),
        stderr: stderrChunks.join(''),
        exitCode: exitCode ?? 0,
      });
    });
  });
}
