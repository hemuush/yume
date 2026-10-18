import { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { DURATIONS } from './motionTimings';

/**
 * Cap on a list row's FadeIn stagger delay (`Math.min(i * step, MAX_LIST_STAGGER_MS)`), shared by every plain
 * list. Zero keeps content available together instead of cascading down the screen.
 */
const MAX_LIST_STAGGER_MS = 0;

/**
 * Home's motion rules: one curve (fast out, soft landing) and a short list of durations so every card moves
 * alike. Scroll- or finger-driven motion (header collapse, drag) has no duration; it follows the finger.
 */
export const MOTION = {
  ease: Easing.out(Easing.cubic),
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

let homeOpeningPlayed = false;

/** Whether Home has already played its opening fade-in since the app was opened. */
export function hasPlayedHomeOpening(): boolean {
  return homeOpeningPlayed;
}

export function markHomeOpeningPlayed(): void {
  homeOpeningPlayed = true;
}

/**
 * How a Home row fades in: a brief simultaneous fade on the first load after open, or one quick unstaggered fade for rows
 * appearing later (new month, pull-to-refresh) so the screen never replays its whole entrance.
 */
export function homeRowEntering(index: number, opening: boolean) {
  return opening
    ? FadeIn.delay(Math.min(index * MOTION.enterStep, MAX_LIST_STAGGER_MS))
        .duration(MOTION.enter)
        .easing(MOTION.ease)
        .reduceMotion(ReduceMotion.System)
    : FadeIn.duration(MOTION.quick).easing(MOTION.ease).reduceMotion(ReduceMotion.System);
}

/**
 * How a Home section arrives: on the first open after the app starts, each rises into place a beat after the
 * one above it; later (a new month, a refresh) it is one quick fade, so the screen never replays its entrance.
 */
export function homeSectionEntering(index: number, opening: boolean) {
  return opening
    ? FadeInDown.delay(index * DURATIONS.sectionStep)
        .duration(DURATIONS.section)
        .easing(MOTION.ease)
        .reduceMotion(ReduceMotion.System)
    : FadeIn.duration(MOTION.quick).easing(MOTION.ease).reduceMotion(ReduceMotion.System);
}

/**
 * Layout motion for lists: rows around an added/removed/reordered row slide into place, a removed row fades
 * out. Kept short, and off entirely when the phone asks for reduced motion.
 */
export const ROW_LAYOUT = LinearTransition.duration(DURATIONS.rowMove)
  .easing(MOTION.ease)
  .reduceMotion(ReduceMotion.System);
export const ROW_EXIT = FadeOut.duration(DURATIONS.rowExit).reduceMotion(ReduceMotion.System);

/**
 * A panel opening in place (Settings accordion, archived accounts): fades in while the rows below slide down
 * (wrap them in MovingRow), and fades out as they slide back up.
 */
export const PANEL_ENTER = FadeIn.duration(DURATIONS.standard)
  .easing(MOTION.ease)
  .reduceMotion(ReduceMotion.System);
