/**
 * Lightweight markdown tokenizer for the chat timeline.
 *
 * We do NOT pull a full markdown parser into the bundle — the timeline
 * cares about three things:
 *   1. Paragraph splits (\n\n).
 *   2. Cross-reference tokens `[ref:<block-id>]` or
 *      `[ref:<block-id>|Label]`.
 *   3. Inline emphasis (we render *…* and **…** via DOM-safe spans).
 *
 * Heavy markdown features (tables, code blocks, lists) are pushed into
 * dedicated genui parts like `markdown-card` and `code-block`.
 */

export interface MdTextSegment {
  readonly kind: 'text';
  readonly text: string;
}

export interface MdEmphasisSegment {
  readonly kind: 'emphasis';
  readonly text: string;
  readonly strength: 'em' | 'strong';
}

export interface MdRefSegment {
  readonly kind: 'ref';
  readonly refToBlockId: string;
  readonly label: string;
}

export type MdSegment = MdTextSegment | MdEmphasisSegment | MdRefSegment;

export interface MdParagraph {
  readonly segments: ReadonlyArray<MdSegment>;
}

const REF_RE = /\[ref:([a-zA-Z0-9_\-:.]+)(?:\|([^\]]+))?\]/g;
const STRONG_RE = /\*\*([^*]+)\*\*/g;
const EM_RE = /\*([^*]+)\*/g;

function tokenizeInline(text: string): MdSegment[] {
  // We pass three rounds: refs, then strong, then em. Each round splits
  // the segments produced by the prior round and replaces matches with
  // typed segments.
  const refSplit: MdSegment[] = [];
  let lastIndex = 0;
  REF_RE.lastIndex = 0;
  let match: RegExpExecArray | null = REF_RE.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) {
      refSplit.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
    }
    refSplit.push({
      kind: 'ref',
      refToBlockId: match[1] as string,
      label: match[2] ?? match[1] ?? '',
    });
    lastIndex = match.index + match[0].length;
    match = REF_RE.exec(text);
  }
  if (lastIndex < text.length) {
    refSplit.push({ kind: 'text', text: text.slice(lastIndex) });
  }
  if (refSplit.length === 0) {
    refSplit.push({ kind: 'text', text });
  }

  const applyEmphasis = (
    segments: ReadonlyArray<MdSegment>,
    pattern: RegExp,
    strength: 'em' | 'strong',
  ): MdSegment[] => {
    const out: MdSegment[] = [];
    for (const segment of segments) {
      if (segment.kind !== 'text') {
        out.push(segment);
        continue;
      }
      const t = segment.text;
      pattern.lastIndex = 0;
      let cursor = 0;
      let matched = false;
      let m: RegExpExecArray | null = pattern.exec(t);
      while (m !== null) {
        matched = true;
        if (m.index > cursor) {
          out.push({ kind: 'text', text: t.slice(cursor, m.index) });
        }
        out.push({ kind: 'emphasis', text: m[1] as string, strength });
        cursor = m.index + m[0].length;
        m = pattern.exec(t);
      }
      if (!matched) {
        out.push(segment);
        continue;
      }
      if (cursor < t.length) {
        out.push({ kind: 'text', text: t.slice(cursor) });
      }
    }
    return out;
  };

  const afterStrong = applyEmphasis(refSplit, STRONG_RE, 'strong');
  const afterEm = applyEmphasis(afterStrong, EM_RE, 'em');
  return afterEm;
}

export function parseMarkdownParagraphs(markdown: string): ReadonlyArray<MdParagraph> {
  const trimmed = markdown.trim();
  if (!trimmed) return [];
  const paragraphs = trimmed.split(/\n{2,}/g);
  return paragraphs.map((paragraph) => ({
    segments: tokenizeInline(paragraph.replace(/\n/g, ' ')),
  }));
}

/** Find every `[ref:...]` token's target id in a paragraph stream. */
export function collectRefTargets(
  paragraphs: ReadonlyArray<MdParagraph>,
): ReadonlyArray<string> {
  const out = new Set<string>();
  for (const paragraph of paragraphs) {
    for (const segment of paragraph.segments) {
      if (segment.kind === 'ref') {
        out.add(segment.refToBlockId);
      }
    }
  }
  return Array.from(out);
}
