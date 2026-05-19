/**
 * Deterministic hash for ledger entries.
 *
 * The substrate hashes BOTH the input and output of every primitive so
 * the ledger can prove a sub-MD acted on the data it claimed to act on.
 *
 * We deliberately use a tiny FNV-1a 64-bit variant in pure JS so the
 * substrate has zero crypto-library dependency. Production wires a
 * stronger hash (BLAKE3 / SHA-256) via the LedgerSealPort; this is the
 * substrate-side fingerprint, not the cryptographic seal.
 */

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = (1n << 64n) - 1n;

/**
 * Deterministic stable-stringify: sort object keys recursively so two
 * structurally equal payloads always produce the same hash regardless of
 * key insertion order.
 */
export function stableStringify(input: unknown): string {
  if (input === null) return 'null';
  if (input === undefined) return 'undefined';
  const t = typeof input;
  if (t === 'number' || t === 'boolean' || t === 'bigint') {
    return String(input);
  }
  if (t === 'string') return JSON.stringify(input);
  if (Array.isArray(input)) {
    return `[${input.map(stableStringify).join(',')}]`;
  }
  if (t === 'object') {
    const entries = Object.entries(input as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(input);
}

/**
 * FNV-1a 64-bit. Returns a 16-hex-char lowercase string.
 */
export function fingerprint(input: unknown): string {
  const s = stableStringify(input);
  let h = FNV_OFFSET_BASIS_64;
  for (let i = 0; i < s.length; i += 1) {
    h = (h ^ BigInt(s.charCodeAt(i))) & MASK_64;
    h = (h * FNV_PRIME_64) & MASK_64;
  }
  return h.toString(16).padStart(16, '0');
}
