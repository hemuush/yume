/**
 * The maths behind Home's account stack (the "Account Stack" sign-off). Every
 * card's position is a pure function of one number — how far the current
 * swipe has got, `p`, from 0 (at rest) to 1 (landed) — so a finger drag, a
 * flick and a keyboard/TalkBack step all play the same animation, and none of
 * it needs React state while it runs. The functions are worklets so the
 * AccountStack can call them on the UI thread; they are plain numbers in and
 * out, so tests call them directly.
 *
 * A swipe: the back card slides out sideways from behind the others (p 0 to
 * `exitEnd`), then comes forward. With four accounts or fewer it returns to the
 * centre and drops into the front slot; with more it leaves the stack and the
 * next account rises into the front slot. Every card behind moves up one slot.
 */

export const STACK = {
  /** Cards shown at once. */
  maxVisible: 4,
  cardHeight: 84,
  /** The strip of each card that peeks out above the next one. */
  peek: 44,
  /** How far the back card tilts as it leaves, in degrees. */
  tilt: 6,
  /** The part of the swipe spent sliding out, as a fraction of p. */
  exitEnd: 0.4,
  /** Release beyond this share of the card width and the swipe goes through. */
  commitShare: 0.22,
  /** Or flick faster than this (px per ms) in the swipe's direction. */
  flickVelocity: 0.5,
  /** A whole swipe, ms. */
  totalMs: 480,
  /** A swipe let go too early springs back in this long, ms. */
  cancelMs: 220,
  /** Under "reduce motion" the order changes with a cross-fade this long, ms. */
  reduceMs: 200,
  /** How far the next account rises from below in the more-than-four case. */
  enterRise: 30,
} as const;

/** How many cards the stack shows for `n` accounts. */
export function visibleCount(n: number): number {
  'worklet';
  return Math.min(STACK.maxVisible, n);
}

/** Height of the stack for `n` accounts. */
export function stackHeight(n: number): number {
  return (visibleCount(n) - 1) * STACK.peek + STACK.cardHeight;
}

/** Where card `index` sits after `base` completed swipes: 0 is the back card, the last visible slot the front. */
export function slotOf(index: number, base: number, n: number): number {
  'worklet';
  return (((index - base) % n) + n) % n;
}

function outCubic(t: number): number {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
}

function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.max(lo, Math.min(hi, v));
}

export interface CardPose {
  x: number;
  y: number;
  /** Degrees. */
  rotate: number;
  scale: number;
  opacity: number;
  /** False for cards beyond the visible window: not drawn, not tappable. */
  shown: boolean;
}

/**
 * The pose of the card in `slot` of `n` at swipe progress `p`, swiping in
 * direction `dir` (+1 right, -1 left), on a stack `width` wide.
 */
export function cardPose(slot: number, n: number, p: number, dir: number, width: number): CardPose {
  'worklet';
  const vis = Math.min(STACK.maxVisible, n);
  const ring = n > vis;
  const frontY = (vis - 1) * STACK.peek;
  const pose: CardPose = { x: 0, y: slot * STACK.peek, rotate: 0, scale: 1, opacity: 1, shown: true };

  if (slot === 0) {
    if (p <= STACK.exitEnd) {
      const u = p / STACK.exitEnd;
      pose.x = dir * width * u;
      pose.rotate = dir * STACK.tilt * u;
      if (ring && p > 0.2) pose.opacity = 1 - (p - 0.2) / (STACK.exitEnd - 0.2);
    } else if (ring) {
      pose.x = dir * width;
      pose.rotate = dir * STACK.tilt;
      pose.opacity = 0;
    } else {
      const e = outCubic((p - STACK.exitEnd) / (1 - STACK.exitEnd));
      pose.x = dir * width * (1 - e);
      pose.y = frontY * e;
      pose.rotate = dir * STACK.tilt * (1 - e);
    }
  } else if (slot < vis) {
    // Starts rising exactly where the swipe commits, so the stack answers before the finger lifts.
    const start = STACK.commitShare * STACK.exitEnd + 0.04 * (slot - 1);
    const t = clamp((p - start) / 0.55, 0, 1);
    pose.y = (slot - outCubic(t)) * STACK.peek;
  } else if (ring && slot === vis) {
    const e = outCubic(clamp((p - STACK.exitEnd) / (1 - STACK.exitEnd), 0, 1));
    pose.y = frontY + STACK.enterRise * (1 - e);
    pose.opacity = clamp((p - STACK.exitEnd) / 0.3, 0, 1);
    pose.scale = 0.97 + 0.03 * e;
  } else {
    pose.shown = false;
    pose.opacity = 0;
  }
  return pose;
}

/** How far a drag of `dx` px has taken the swipe, on a stack `width` wide (it never goes past the exit). */
export function dragProgress(dx: number, width: number): number {
  if (width <= 0) return 0;
  return clamp(Math.abs(dx) / width, 0, 1) * STACK.exitEnd;
}

/** Whether letting go at progress `p` with horizontal velocity `vx` (px/ms) goes through. */
export function shouldCommit(p: number, vx: number, dir: number): boolean {
  if (p >= STACK.commitShare * STACK.exitEnd) return true;
  return p > 0.04 && Math.abs(vx) > STACK.flickVelocity && Math.sign(vx) === dir;
}
