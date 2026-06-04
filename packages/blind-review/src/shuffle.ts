/**
 * Deterministic shuffle (mulberry32) for replayable blind-review runs.
 *
 * A fixed seed yields a fixed permutation, so a regulator drill or a CI
 * gate can be re-run and reproduce the exact reviewer ordering. Pure: the
 * input array is never mutated.
 *
 * @module @bossnyumba/blind-review/shuffle
 */

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deterministicShuffle<T>(
  items: ReadonlyArray<T>,
  seed: number,
): ReadonlyArray<T> {
  const rng = mulberry32(seed);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i] as T;
    const b = arr[j] as T;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}
