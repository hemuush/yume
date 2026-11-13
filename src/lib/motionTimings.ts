import { Easing } from 'react-native';

/**
 * App motion durations (ms) without a Reanimated import, so core-`Animated` code (the press feedback, the switch knob) runs
 * in tests without the Reanimated mock. `MOTION` in animation.ts adds the shared curve. The rule: motion is quiet and
 * short; things fade or glide to a new state, never rise, roll, stagger or bounce.
 */
export const DURATIONS = {
  /** Fades and highlight changes. */
  quick: 150,
  /** Rows opening/closing, a swipe settling back, a bar gliding to a new value. */
  standard: 200,
  /** A page turn (the month changing): out, then in. */
  slideOut: 140,
  slideIn: 220,
  /** A goal ring or bar filling after a real change. Nothing draws in from empty on first view. */
  draw: 240,
  /** The opening fade-in of a screen, and a Home section arriving. Plain fades: no travel, no stagger. */
  enter: 180,
  section: 200,
  /** A list row sliding into its new place / fading out when removed. */
  rowMove: 200,
  rowExit: 150,
} as const;

/** The shared fast-out, soft-landing curve for core-`Animated` code (MOTION.ease is the same curve for Reanimated). */
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
