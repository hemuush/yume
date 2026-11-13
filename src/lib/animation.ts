import {
  cubicBezier,
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';
import { DURATIONS } from './motionTimings';

/**
 * Home's motion rules: one curve (fast out, soft landing) and a short list of durations so every card moves
 * alike. Scroll- or finger-driven motion (header collapse, drag) has no duration; it follows the finger.
 */
export const MOTION = {
  ease: Easing.bezier(0.22, 1, 0.36, 1),
  /** Leaving: starts gently and speeds away, so exits never feel like they hang. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  ...DURATIONS,
} as const;

/**
 * One style property (or several) that glides to its new value, as a CSS transition on the shared curve. State-driven (a capsule
 * picked, a slice dimmed): the style says where it should be and Reanimated's CSS engine does the gliding on the UI
 * thread, with no shared value, effect or worklet to write. Nothing happens on first showing, only on a change.
 * `reduce` is the phone's reduce-motion setting: the value then jumps.
 */
type Glidable = 'height' | 'opacity' | 'transform';
export function glide(property: Glidable | Glidable[], reduce: boolean, duration = DURATIONS.standard) {
  return {
    transitionProperty: property,
    // Written with its unit: valid in Reanimated and as plain CSS alike.
    transitionDuration: `${reduce ? 0 : duration}ms` as const,
    transitionTimingFunction: cubicBezier(0.22, 1, 0.36, 1),
  } as const;
}

/**
 * A `withTiming` config on the shared curve. A worklet, so safe inside UI-thread animation callbacks,
 * though building the config up front on the JS thread is the simpler habit.
 */
export function timing(duration: number) {
  'worklet';
  return { duration, easing: MOTION.ease };
}

let homeOpeningPlayed = false;

/** Whether Home has already played its opening fade-in since the app was opened. */
export function hasPlayedHomeOpening(): boolean {
  return homeOpeningPlayed;
}

export function markHomeOpeningPlayed(): void {
  homeOpeningPlayed = true;
}

/**
 * How a Home row arrives: one plain fade, on the first load after open and for rows appearing later (new month,
 * pull-to-refresh), so the screen never replays an entrance. No stagger, no travel.
 */
export function homeRowEntering(_index: number, opening: boolean) {
  return FadeIn.duration(opening ? MOTION.enter : MOTION.quick)
    .easing(MOTION.ease)
    .reduceMotion(ReduceMotion.System);
}

/** How a Home section arrives: the same plain fade as a row, a touch longer on the first open. */
export function homeSectionEntering(_index: number, opening: boolean) {
  return FadeIn.duration(opening ? DURATIONS.section : MOTION.quick)
    .easing(MOTION.ease)
    .reduceMotion(ReduceMotion.System);
}

/**
 * Layout motion for lists: rows around an added/removed/reordered row slide into place, a removed row fades
 * out. Kept short, and off entirely when the phone asks for reduced motion.
 */
export const ROW_LAYOUT = LinearTransition.duration(DURATIONS.rowMove)
  .easing(MOTION.ease)
  .reduceMotion(ReduceMotion.System);
export const ROW_EXIT = FadeOut.duration(DURATIONS.rowExit)
  .easing(MOTION.exit)
  .reduceMotion(ReduceMotion.System);

/**
 * A panel opening in place (Settings accordion, archived accounts): fades in while the rows below slide down
 * (wrap them in MovingRow), and fades out as they slide back up.
 */
export const PANEL_ENTER = FadeIn.duration(DURATIONS.standard)
  .easing(MOTION.ease)
  .reduceMotion(ReduceMotion.System);

/**
 * Content swapping in place (a Plan/Reports tab, a picked day's detail): one plain fade, so the new view appears
 * without moving.
 */
export const CONTENT_ENTER = FadeIn.duration(DURATIONS.quick)
  .easing(MOTION.ease)
  .reduceMotion(ReduceMotion.System);
