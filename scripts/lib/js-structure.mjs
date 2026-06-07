/**
 * js-structure — lexer-lite helpers for navigating JS/TS source structurally
 * without a full parser. Used by static-analysis audit scripts that need to
 * find the body of the function enclosing a match, or the balanced body of a
 * parenthesised construct, while ignoring braces/parens that live inside
 * strings, template literals (incl. `sql\`\`` blocks with `${…}`), and
 * comments.
 *
 * These are intentionally approximate: over-widening a window only makes a
 * conservative scanner suppress more (favouring false-negatives), never the
 * reverse.
 */

/**
 * Replace the CONTENTS of string literals, template literals, and comments
 * with spaces, preserving length and newlines. Braces/parens inside strings
 * or comments are thereby hidden from balanced-delimiter walks that would
 * otherwise be thrown off by `${…}` interpolations and `{…}` inside big
 * `sql\`\`` blocks. Cached per source string.
 *
 * @param {string} src
 * @returns {string} masked copy, same length as `src`
 */
const _maskCache = new Map();
export function maskStringsAndComments(src) {
  const cached = _maskCache.get(src);
  if (cached) return cached;
  const out = new Array(src.length);
  let i = 0;
  const N = src.length;
  const blank = (from, to) => {
    for (let k = from; k < to; k++) out[k] = src[k] === '\n' ? '\n' : ' ';
  };
  while (i < N) {
    const ch = src[i];
    const two = src.slice(i, i + 2);
    if (two === '//') {
      let j = src.indexOf('\n', i);
      if (j === -1) j = N;
      blank(i, j);
      i = j;
    } else if (two === '/*') {
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? N : j + 2;
      blank(i, j);
      i = j;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out[i] = ' ';
      let j = i + 1;
      while (j < N) {
        if (src[j] === '\\') {
          out[j] = ' ';
          out[j + 1] = src[j + 1] === '\n' ? '\n' : ' ';
          j += 2;
          continue;
        }
        if (src[j] === quote) break;
        out[j] = src[j] === '\n' ? '\n' : ' ';
        j++;
      }
      out[j] = ' ';
      i = j + 1;
    } else {
      out[i] = ch;
      i++;
    }
  }
  const masked = out.join('');
  if (_maskCache.size > 64) _maskCache.clear();
  _maskCache.set(src, masked);
  return masked;
}

// A brace that opens a function/method/arrow body — recognised by the
// characters immediately preceding it on the masked source:
//   `) {`  method/function body · `) : Type {` typed body · `=> {` arrow body.
// We deliberately also accept `) {` from control-flow (if/for/while) — that
// only WIDENS the window when we stop too early, which stays conservative.
const FN_HEADER_RX = /(=>|\)(\s*:\s*[\w<>,.\[\]| &]+?)?)\s*$/;

/**
 * Balanced-forward match of the brace at `openBrace` over a masked source.
 * @returns {[number, number]} [openBrace, closeBraceExclusive)
 */
function matchForward(src, masked, openBrace) {
  let d = 0;
  for (let i = openBrace; i < src.length; i++) {
    const ch = masked[i];
    if (ch === '{') d++;
    else if (ch === '}') {
      d--;
      if (d === 0) return [openBrace, i + 1];
    }
  }
  return [openBrace, src.length];
}

/**
 * Return `[openBrace, closeBraceExclusive)` of the function/method that
 * lexically encloses `idx`. Brace-matching runs over a string/comment-masked
 * copy so braces inside SQL templates / strings don't confuse the walk. We
 * climb OUT through nested blocks (try/if/for/object literals) until the
 * opening brace is preceded by a function/arrow header — so a value built
 * before a `try { … }` in the same method is still inside the returned span.
 * Falls back to the whole file when boundaries can't be resolved.
 *
 * @param {string} src
 * @param {number} idx
 * @returns {[number, number]}
 */
export function enclosingFunctionRange(src, idx) {
  const masked = maskStringsAndComments(src);
  let cursor = idx;
  let lastOpen = -1;
  for (let level = 0; level < 40; level++) {
    let depth = 0;
    let openBrace = -1;
    for (let i = cursor; i >= 0; i--) {
      const ch = masked[i];
      if (ch === '}') depth++;
      else if (ch === '{') {
        if (depth === 0) {
          openBrace = i;
          break;
        }
        depth--;
      }
    }
    if (openBrace === -1) break;
    lastOpen = openBrace;
    const before = masked.slice(Math.max(0, openBrace - 80), openBrace).trimEnd();
    if (FN_HEADER_RX.test(before) || /\bfunction\b[\w\s]*$/.test(before)) {
      return matchForward(src, masked, openBrace);
    }
    cursor = openBrace - 1;
  }
  if (lastOpen === -1) return [0, src.length];
  return matchForward(src, masked, lastOpen);
}

/**
 * Body text (from the ORIGINAL source) of the function/method enclosing
 * `idx`.
 *
 * @param {string} src
 * @param {number} idx
 * @returns {string}
 */
export function enclosingFunctionBody(src, idx) {
  const [open, close] = enclosingFunctionRange(src, idx);
  return src.slice(open, close);
}

/**
 * Extract the parenthesised body that begins at `openParenIdx` (which must
 * point at a `(`), balancing nested parens over the RAW source. Returns ''
 * if unbalanced. Suitable for SQL bodies where parens are not nested inside
 * strings (e.g. a migration's `CREATE TABLE name ( … )` column list after
 * comment-stripping).
 *
 * @param {string} src
 * @param {number} openParenIdx
 * @returns {string}
 */
export function extractParenBody(src, openParenIdx) {
  let depth = 0;
  for (let i = openParenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return src.slice(openParenIdx + 1, i);
    }
  }
  return '';
}
