/**
 * BossNyumba first-boot corpus ingestion job (parity port from Borjie).
 *
 * Reads the real-estate-domain markdown corpus (NHC briefings,
 * TRA/KRA guidance, lease templates, condo bylaws, tenancy regulations),
 * chunks each file by H2 (`^## `), embeds each chunk, and upserts into
 * `intelligence_corpus_chunks` with `tenant_id = NULL` (global rows) so
 * every BossNyumba tenant inherits the same baseline knowledge on first
 * sign-in.
 *
 * Mirrors `services/consolidation-worker/src/tasks/borjie-corpus-ingest.ts`
 * 1:1 in shape; the only domain swap is the `DEFAULT_DOCS_ROOT` env var
 * and the canonical seed sub-directories that the CLI walks.
 *
 * ---------------------------------------------------------------------
 * Architecture
 * ---------------------------------------------------------------------
 *
 *   - Storage + embedding are abstracted by ports (`CorpusSink`,
 *     `Embedder`). Business logic here compiles + tests without ever
 *     touching `@bossnyumba/database` or `drizzle-orm`. Concrete
 *     adapters live in `./bossnyumba-corpus-adapters.ts`.
 *
 *   - Idempotent on `(source_file, section)`: re-running the job
 *     overwrites the existing row's content + embedding rather than
 *     producing duplicates. The schema includes a soft
 *     `superseded_by_id` field for time-travel; we leave it unset on
 *     vanilla re-ingest.
 *
 *   - APPEND-ONLY rule honoured: we never DELETE; the upsert path only
 *     UPDATEs the text+embedding of an existing source/section pair.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────
// Public types — ports
// ─────────────────────────────────────────────────────────────────────

export interface CorpusChunk {
  readonly sourceFile: string;
  readonly sectionHeading: string;
  readonly content: string;
  readonly ingestedAt: string;
}

export interface CorpusUpsertRow extends CorpusChunk {
  readonly id: string;
  readonly embedding: ReadonlyArray<number>;
}

export interface CorpusSink {
  /**
   * Idempotent upsert keyed on `(source_file, section)`. Must overwrite
   * content + embedding when the same key arrives twice.
   */
  upsert(row: CorpusUpsertRow): Promise<void>;
}

export interface Embedder {
  embed(text: string): Promise<ReadonlyArray<number>>;
}

export interface WorkerLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface IngestOptions {
  readonly corpusRoots: ReadonlyArray<string>;
  readonly sink: CorpusSink;
  readonly embedder: Embedder;
  readonly logger?: WorkerLogger;
  /** Skip embedding for very small chunks (< minBytes). Default 64. */
  readonly minBytes?: number;
}

export interface IngestReport {
  readonly filesScanned: number;
  readonly chunksWritten: number;
  readonly chunksSkipped: number;
  readonly errors: ReadonlyArray<string>;
}

// ─────────────────────────────────────────────────────────────────────
// Core ingest — pure logic, no I/O wiring
// ─────────────────────────────────────────────────────────────────────

/**
 * Recursively walk each corpus root, split markdown by H2, embed, and
 * upsert. Errors per-file are absorbed so a single bad file does not
 * stop the run.
 */
export async function ingestCorpus(opts: IngestOptions): Promise<IngestReport> {
  const minBytes = opts.minBytes ?? 64;
  const errors: string[] = [];
  let filesScanned = 0;
  let chunksWritten = 0;
  let chunksSkipped = 0;

  for (const root of opts.corpusRoots) {
    const files = await walkMarkdown(root, errors);
    for (const absolutePath of files) {
      filesScanned += 1;
      try {
        // SCRUB-5f: justified-because path comes from walkMarkdown() recursing
        // operator-supplied corpus roots; not user input. Filenames are
        // filtered to *.md and resolved via path.join from the trusted root.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const raw = await readFile(absolutePath, 'utf8');
        const relPath = relative(root, absolutePath);
        const sourceFile = join(basename(root), relPath);
        const chunks = splitByH2(sourceFile, raw);
        for (const chunk of chunks) {
          if (chunk.content.length < minBytes) {
            chunksSkipped += 1;
            continue;
          }
          const embedding = await opts.embedder.embed(chunk.content);
          const id = deterministicId(chunk.sourceFile, chunk.sectionHeading);
          await opts.sink.upsert({ ...chunk, id, embedding });
          chunksWritten += 1;
        }
      } catch (error) {
        const msg = `ingest failed for ${absolutePath}: ${asMessage(error)}`;
        errors.push(msg);
        opts.logger?.warn('bossnyumba-corpus-ingest: file failed', {
          file: absolutePath,
          error: asMessage(error),
        });
      }
    }
  }

  opts.logger?.info('bossnyumba-corpus-ingest: completed', {
    filesScanned,
    chunksWritten,
    chunksSkipped,
    errorCount: errors.length,
  });

  return { filesScanned, chunksWritten, chunksSkipped, errors };
}

/**
 * Split a markdown document by H2 (`^## `) into one chunk per section.
 * Content above the first H2 is captured as a synthetic `__preamble__`
 * section so introductions are not lost.
 */
export function splitByH2(
  sourceFile: string,
  raw: string,
): ReadonlyArray<CorpusChunk> {
  const lines = raw.split(/\r?\n/);
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } = {
    heading: '__preamble__',
    body: [],
  };

  for (const line of lines) {
    if (/^##\s+/.test(line) && !/^###/.test(line)) {
      if (current.body.length > 0 || current.heading !== '__preamble__') {
        sections.push(current);
      }
      const heading = line.replace(/^##\s+/, '').trim();
      current = { heading, body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.length > 0) sections.push(current);

  const ingestedAt = new Date().toISOString();
  return sections.map((section) =>
    Object.freeze({
      sourceFile,
      sectionHeading: section.heading,
      content: section.body.join('\n').trim(),
      ingestedAt,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

async function walkMarkdown(root: string, errors: string[]): Promise<string[]> {
  const out: string[] = [];
  try {
    // SCRUB-5f: justified-because `root` is an operator-supplied corpus
    // root from IngestOptions.corpusRoots — never user input. Recursion
    // only descends into already-trusted directories.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(root, entry.name);
      if (entry.isDirectory()) {
        const children = await walkMarkdown(full, errors);
        out.push(...children);
      } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
        const sizeOk = await isReadableFile(full);
        if (sizeOk) out.push(full);
      }
    }
  } catch (error) {
    errors.push(`walk failed at ${root}: ${asMessage(error)}`);
  }
  return out;
}

async function isReadableFile(path: string): Promise<boolean> {
  try {
    // SCRUB-5f: justified-because `path` is built from walkMarkdown() output
    // which only emits files matching `\.md$` joined from trusted corpus
    // roots; not user input. Errors are absorbed by the catch-block above.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const s = await stat(path);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

function basename(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return idx === -1 ? trimmed : trimmed.slice(idx + 1);
}

function deterministicId(sourceFile: string, sectionHeading: string): string {
  // Stable id derived from the upsert key so re-runs are byte-identical.
  return createHash('sha256')
    .update(`${sourceFile}::${sectionHeading}`)
    .digest('hex')
    .slice(0, 32);
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ─────────────────────────────────────────────────────────────────────
// CLI entrypoint — pnpm tsx src/tasks/bossnyumba-corpus-ingest.ts
//
// The CLI composition root (env-driven wiring, embedder + sink
// resolution, process.exit) lives in `./bossnyumba-corpus-cli.ts` to
// keep this module focused on the pure ingest pipeline. We re-export
// `main` and `CliOptions` so callers and the `pnpm tsx ...bossnyumba-
// corpus-ingest.ts` invocation both work.
// ─────────────────────────────────────────────────────────────────────

export { main, type CliOptions } from './bossnyumba-corpus-cli.js';

const isDirect =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  /bossnyumba-corpus-ingest(\.js|\.ts)?$/.test(process.argv[1]);

if (isDirect) {
  // Lazy-import the CLI so the core module has zero side effects when
  // imported as a library.
  void import('./bossnyumba-corpus-cli.js').then(async (mod) => {
    try {
      await mod.main();
    } catch (error) {
      process.stderr.write(
        `bossnyumba-corpus-ingest fatal: ${
          error instanceof Error ? error.message : String(error)
        }\n`,
      );
      process.exit(2);
    }
  });
}
