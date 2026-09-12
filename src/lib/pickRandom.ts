/**
 * Picks one item uniformly at random from a pool — the one seam every
 * rotating-wording pool in the app (Suu's line, push notification copy)
 * goes through, so there's a single place to reason about (or mock, in
 * tests) instead of each call site rolling its own `Math.random()`.
 */
export function pickRandom<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}
