/**
 * Dependency-free, client-side QR encoder (numeric/alphanumeric/byte, up to
 * version 10, EC level M). Used to render an `otpauth://` enrollment QR for the
 * Settings → Security 2FA flow WITHOUT shipping the TOTP secret to any external
 * QR-image service (privacy: the secret never leaves the browser).
 *
 * This is a compact, self-contained implementation of the QR matrix generator
 * (ISO/IEC 18004) sufficient for otpauth URIs. Returns the boolean module
 * matrix; `qrMatrixToSvgPath` renders it as an inline-SVG path string.
 *
 * Scope guard: encodes in byte mode (UTF-8) which always works for otpauth
 * URIs; picks the smallest version that fits. Throws if the payload exceeds the
 * version-10 byte capacity (an otpauth URI never approaches that).
 */

// Galois field (GF(256)) log/antilog tables for Reed-Solomon EC.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= gfMul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const res = new Array(ecLen).fill(0);
  for (let i = 0; i < data.length; i += 1) {
    const factor = data[i] ^ res[0];
    res.shift();
    res.push(0);
    for (let j = 0; j < ecLen; j += 1) res[j] ^= gfMul(gen[j], factor);
  }
  return res;
}

// Per-version (1..10), EC level M: [totalCodewords, ecPerBlock, numBlocks].
// Single-EC-group versions only (sufficient ≤ v10 for our payload sizes).
const VERSION_INFO: Record<
  number,
  { size: number; ecPerBlock: number; group1Blocks: number; dataPerBlock: number }
> = {
  1: { size: 21, ecPerBlock: 10, group1Blocks: 1, dataPerBlock: 16 },
  2: { size: 25, ecPerBlock: 16, group1Blocks: 1, dataPerBlock: 28 },
  3: { size: 29, ecPerBlock: 26, group1Blocks: 1, dataPerBlock: 44 },
  4: { size: 33, ecPerBlock: 18, group1Blocks: 2, dataPerBlock: 32 },
  5: { size: 37, ecPerBlock: 24, group1Blocks: 2, dataPerBlock: 43 },
  6: { size: 41, ecPerBlock: 16, group1Blocks: 4, dataPerBlock: 27 },
  7: { size: 45, ecPerBlock: 18, group1Blocks: 4, dataPerBlock: 31 },
  8: { size: 49, ecPerBlock: 22, group1Blocks: 2, dataPerBlock: 38 },
  9: { size: 53, ecPerBlock: 22, group1Blocks: 3, dataPerBlock: 36 },
  10: { size: 57, ecPerBlock: 26, group1Blocks: 4, dataPerBlock: 43 },
};

// Alignment-pattern centre coordinates per version (empty for v1).
const ALIGN_POS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

function toUtf8Bytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 10; v += 1) {
    const info = VERSION_INFO[v];
    const dataCodewords = info.dataPerBlock * info.group1Blocks;
    // header: mode (4) + char-count (8 for v1-9, 16 for v10) bits + terminator
    const countBits = v >= 10 ? 16 : 8;
    const capacityBytes = Math.floor((dataCodewords * 8 - 4 - countBits) / 8);
    if (byteLen <= capacityBytes) return v;
  }
  throw new Error('QR payload too large for this minimal encoder (>v10)');
}

function buildBitstream(bytes: number[], version: number): number[] {
  const info = VERSION_INFO[version];
  const dataCodewords = info.dataPerBlock * info.group1Blocks;
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, version >= 10 ? 16 : 8);
  for (const b of bytes) push(b, 8);
  // terminator
  const cap = dataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < cap; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  // pad bytes 0xEC / 0x11 alternating
  const padBytes = [0xec, 0x11];
  let p = 0;
  while (bits.length < cap) {
    push(padBytes[p % 2], 8);
    p += 1;
  }
  // to codewords
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  return codewords;
}

function interleave(dataCodewords: number[], version: number): number[] {
  const info = VERSION_INFO[version];
  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  for (let b = 0; b < info.group1Blocks; b += 1) {
    const data = dataCodewords.slice(offset, offset + info.dataPerBlock);
    offset += info.dataPerBlock;
    blocks.push({ data, ec: rsEncode(data, info.ecPerBlock) });
  }
  const result: number[] = [];
  for (let i = 0; i < info.dataPerBlock; i += 1) {
    for (const blk of blocks) if (i < blk.data.length) result.push(blk.data[i]);
  }
  for (let i = 0; i < info.ecPerBlock; i += 1) {
    for (const blk of blocks) result.push(blk.ec[i]);
  }
  return result;
}

type Matrix = (number | null)[][];

function makeMatrix(size: number): Matrix {
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

function placeFinder(m: Matrix, row: number, col: number): void {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= m.length || cc < 0 || cc >= m.length) continue;
      const inRing =
        (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
        (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
        (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      m[rr][cc] = inRing ? 1 : 0;
    }
  }
}

// A finder pattern (with separator) occupies the 8x8 block in each of the
// three corners. An alignment pattern centred inside such a block is omitted
// per spec; everywhere else (including the timing row/col) it IS placed and
// correctly overwrites the timing modules.
function overlapsFinder(size: number, r: number, c: number): boolean {
  const near = (cr: number, cc: number) => Math.abs(r - cr) <= 4 && Math.abs(c - cc) <= 4;
  return near(3, 3) || near(3, size - 4) || near(size - 4, 3);
}

function placeAlignment(m: Matrix, size: number, version: number): void {
  const positions = ALIGN_POS[version];
  for (const r of positions) {
    for (const c of positions) {
      if (overlapsFinder(size, r, c)) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const isDark =
            Math.max(Math.abs(dr), Math.abs(dc)) !== 1; // ring + centre
          m[r + dr][c + dc] = isDark ? 1 : 0;
        }
      }
    }
  }
}

function placeTimingAndDark(m: Matrix, size: number, version: number): void {
  for (let i = 8; i < size - 8; i += 1) {
    if (m[6][i] === null) m[6][i] = i % 2 === 0 ? 1 : 0;
    if (m[i][6] === null) m[i][6] = i % 2 === 0 ? 1 : 0;
  }
  m[size - 8][8] = 1; // dark module
  // reserve format-info areas (set to 0 placeholder; filled later)
  for (let i = 0; i < 9; i += 1) {
    if (m[8][i] === null) m[8][i] = 0;
    if (m[i][8] === null) m[i][8] = 0;
  }
  for (let i = size - 8; i < size; i += 1) {
    if (m[8][i] === null) m[8][i] = 0;
    if (m[i][8] === null) m[i][8] = 0;
  }
  void version;
}

function isReserved(m: Matrix, r: number, c: number): boolean {
  return m[r][c] !== null;
}

function placeData(m: Matrix, bytes: number[], size: number): void {
  const bits: number[] = [];
  for (const b of bytes) for (let i = 7; i >= 0; i -= 1) bits.push((b >> i) & 1);
  let idx = 0;
  let upward = true;
  // Textbook two-columns-at-a-time zig-zag from the right edge, skipping the
  // vertical timing column (col 6) globally so every non-function module is
  // visited exactly once.
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      const row = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j += 1) {
        const col = right - j;
        if (col < 0) continue;
        if (!isReserved(m, row, col)) {
          m[row][col] = idx < bits.length ? bits[idx] : 0;
          idx += 1;
        }
      }
    }
    upward = !upward;
  }
}

// Version information (BCH(18,6)) for versions 7..10 — the only versions that
// carry it. Values are the spec-fixed encodings (LSB-first placement below).
const VERSION_INFO_BITS: Record<number, number> = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
  10: 0x0a4d3,
};

// Reserve the two 6x3 version-information blocks (v7+). Placed before data so
// the zig-zag treats them as function modules.
function reserveVersionInfo(m: Matrix, size: number, version: number): void {
  if (version < 7) return;
  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      m[i][size - 11 + j] = 0;
      m[size - 11 + j][i] = 0;
    }
  }
}

function placeVersionInfo(m: Matrix, size: number, version: number): void {
  if (version < 7) return;
  const bits = VERSION_INFO_BITS[version];
  for (let i = 0; i < 18; i += 1) {
    const bit = (bits >> i) & 1;
    const r = Math.floor(i / 3);
    const c = i % 3;
    // Top-right block and its transpose at bottom-left.
    m[r][size - 11 + c] = bit;
    m[size - 11 + c][r] = bit;
  }
}

function applyMask(m: Matrix, size: number, reserved: boolean[][]): void {
  // Mask 0: (row + col) % 2 === 0.
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (reserved[r][c]) continue;
      if ((r + c) % 2 === 0) m[r][c] = (m[r][c] as number) ^ 1;
    }
  }
}

// Pre-computed format-info bits for EC level M + mask pattern 0.
const FORMAT_BITS_M0 = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

function placeFormat(m: Matrix, size: number): void {
  const bits = FORMAT_BITS_M0;
  // Around top-left finder.
  for (let i = 0; i <= 5; i += 1) m[8][i] = bits[i];
  m[8][7] = bits[6];
  m[8][8] = bits[7];
  m[7][8] = bits[8];
  for (let i = 9; i < 15; i += 1) m[14 - i][8] = bits[i];
  // Around the other two finders.
  for (let i = 0; i <= 7; i += 1) m[size - 1 - i][8] = bits[i];
  for (let i = 8; i < 15; i += 1) m[8][size - 15 + i] = bits[i];
}

/** Encode `text` into a boolean QR module matrix (true = dark). */
export function encodeQr(text: string): boolean[][] {
  const bytes = toUtf8Bytes(text);
  const version = pickVersion(bytes.length);
  const info = VERSION_INFO[version];
  const size = info.size;

  const m = makeMatrix(size);
  placeFinder(m, 0, 0);
  placeFinder(m, 0, size - 7);
  placeFinder(m, size - 7, 0);
  // separators are implicit (the null ring around finders stays light)
  placeTimingAndDark(m, size, version);
  reserveVersionInfo(m, size, version);
  placeAlignment(m, size, version);

  // Snapshot which cells are function/reserved BEFORE data placement.
  const reserved: boolean[][] = m.map((row) => row.map((v) => v !== null));

  const codewords = buildBitstream(bytes, version);
  const finalCodewords = interleave(codewords, version);
  placeData(m, finalCodewords, size);
  applyMask(m, size, reserved);
  placeFormat(m, size);
  placeVersionInfo(m, size, version);

  return m.map((row) => row.map((v) => v === 1));
}

/**
 * Render a QR module matrix as an SVG `<path d="...">` string (dark modules
 * only). Caller wraps it in an <svg viewBox="0 0 N N"> where N === matrix size.
 */
export function qrMatrixToSvgPath(matrix: boolean[][]): { path: string; size: number } {
  const size = matrix.length;
  let path = '';
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (matrix[r][c]) path += `M${c} ${r}h1v1h-1z`;
    }
  }
  return { path, size };
}
