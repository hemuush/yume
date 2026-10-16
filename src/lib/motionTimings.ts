/**
 * App motion durations (ms) without a Reanimated import, so core-`Animated` code (useGrowFrom, CountUpAmount,
 * GoalRing) runs in tests without the Reanimated mock. `MOTION` in animation.ts adds the shared curve.
 */
export const DURATIONS = {
  /** Fades and highlight changes. */
  quick: 140,
  /** Rows opening/closing, a swipe settling back, a bar gliding to a new value. */
  standard: 180,
  /** A page turn (the month changing): out, then in. */
  slideOut: 140,
  slideIn: 220,
  /** Shapes and bars drawing in, and a goal ring filling. */
  draw: 320,
  /** Figures counting up. */
  count: 220,
  /** The opening fade-in, and the gap between one row's start and the next. */
  enter: 160,
  enterStep: 0,
  /** A Home section rising into place when Home first opens, and the gap before the next one starts. */
  section: 520,
  sectionStep: 70,
  /** A list row sliding into its new place / fading out when removed. */
  rowMove: 180,
  rowExit: 160,
} as const;
