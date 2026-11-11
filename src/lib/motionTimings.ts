/**
 * App motion durations (ms) without a Reanimated import, so core-`Animated` code (useGrowFrom, CountUpAmount,
 * PaceBar) runs in tests without the Reanimated mock. `MOTION` in animation.ts adds the shared curve.
 */
export const DURATIONS = {
  /** Fades and highlight changes. */
  quick: 180,
  /** Rows opening/closing, a swipe settling back, a bar gliding to a new value. */
  standard: 240,
  /** A page turn (the month changing): out, then in. */
  slideOut: 160,
  slideIn: 280,
  /** Shapes and bars drawing in, and a goal ring filling. */
  draw: 420,
  /** Figures counting up. */
  count: 320,
  /** A short interpolation when the month card amount changes. */
  rollUp: 340,
  /** The opening fade-in, and the gap between one row's start and the next. */
  enter: 220,
  enterStep: 0,
  /** A Home section rising into place on the first open, and the gap between one section's start and the next. */
  section: 340,
  sectionStep: 55,
  /** A list row sliding into its new place / fading out when removed. */
  rowMove: 260,
  rowExit: 200,
} as const;
