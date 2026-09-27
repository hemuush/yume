/**
 * The app's motion durations (ms) on their own, with no Reanimated import:
 * core-`Animated` code (useGrowFrom, CountUpAmount, GoalRing) reads them
 * from here, so it runs in tests without the Reanimated mock.
 * `MOTION` in animation.ts is these plus the shared curve.
 */
export const DURATIONS = {
  /** Fades and highlight changes. */
  quick: 200,
  /** Rows opening/closing, a swipe settling back, a bar gliding to a new value. */
  standard: 240,
  /** A page turn (the month changing): out, then in. */
  slideOut: 140,
  slideIn: 220,
  /** Shapes and bars drawing in, and a goal ring filling. */
  draw: 700,
  /** Figures counting up. */
  count: 550,
  /** The opening fade-in, and the gap between one row's start and the next. */
  enter: 280,
  enterStep: 50,
  /** A list row sliding into its new place / fading out when removed. */
  rowMove: 220,
  rowExit: 160,
} as const;
