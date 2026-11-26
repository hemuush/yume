import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
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
 * A `withTiming` config on the shared curve. A worklet, so safe inside UI-thread animation callbacks,
 * though building the config up front on the JS thread is the simpler habit.
 */
export function timing(duration: number) {
  'worklet';
  return { duration, easing: MOTION.ease };
}

// Built once: the same object every time, so a component given one as a prop is not seen to change on each render.
const ROW_OPENING = FadeIn.duration(MOTION.enter).easing(MOTION.ease).reduceMotion(ReduceMotion.System);
const ROW_QUICK = FadeIn.duration(MOTION.quick).easing(MOTION.ease).reduceMotion(ReduceMotion.System);

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
  return opening ? ROW_OPENING : ROW_QUICK;
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

/** A panel docked at the bottom (the number pad) rising in and sinking out, so it never just pops. */
export const DOCK_ENTER = FadeInDown.duration(DURATIONS.standard)
  .easing(MOTION.ease)
  .reduceMotion(ReduceMotion.System);
export const DOCK_EXIT = FadeOutDown.duration(DURATIONS.rowExit)
  .easing(MOTION.exit)
  .reduceMotion(ReduceMotion.System);

/** Content appearing in place (a loaded list, a picked day's detail): one plain fade, without moving. */
export const CONTENT_ENTER = FadeIn.duration(DURATIONS.quick)
  .easing(MOTION.ease)
  .reduceMotion(ReduceMotion.System);

/** A tab of a screen swapping in place (Plan's and Reports' tabs): the same plain fade, so every switch is quiet. */
export const TAB_ENTER = CONTENT_ENTER;

/**
 * A list's first cards arriving one after another: each rises 12 dp while fading in, 35 ms after the one before it, for
 * the first six only so a long list never waits. Built once per index.
 */
const STAGGER = Array.from({ length: 6 }, (_, i) =>
  FadeInDown.duration(DURATIONS.standard)
    .delay(i * 35)
    .easing(MOTION.ease)
    .reduceMotion(ReduceMotion.System)
);
export const staggerEnter = (index: number) => STAGGER[Math.min(Math.max(index, 0), STAGGER.length - 1)];
