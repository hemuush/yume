/**
 * Picks one item uniformly at random: the one seam for every rotating-wording pool (Suu's line, push copy),
 * so there is one place to reason about or mock in tests instead of scattered `Math.random()`.
 */
export function pickRandom<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}
