import { Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { DURATIONS } from './motionTimings';

/**
 * Cap on a list row's FadeIn entrance stagger delay (`Math.min(i * step, MAX_LIST_STAGGER_MS)`)
 * — shared by every plain list of cards/rows in the app (Home's sections, Transactions'
 * day groups, People, Recurring rules, Reports' heatmap) so a long list still finishes
 * settling in well under a second, and so retuning the app-wide stagger feel is a one-line
 * change instead of hunting down a copy of this constant in each screen.
 */
export const MAX_LIST_STAGGER_MS = 320;

/**
 * Home's motion rules (change 9 of the Home sign-off): one curve — fast out
 * of the gate, soft landing — and a short list of durations, so every card
 * moves the same way instead of each picking its own timing and easing.
 * Anything scroll- or finger-driven (the header collapse, a drag) has no
 * duration at all: it follows the finger.
 */
export const MOTION = {
  ease: Easing.out(Easing.cubic),
  ...DURATIONS,
} as const;

/**
 * A `withTiming` config on the shared curve. Marked as a worklet so it's
 * also safe to call from inside an animation callback (which runs on the UI
 * thread) — though building the config up front on the JS thread, and
 * capturing the object, is the simpler habit.
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
 * How a Home row fades in: the staggered opening fade on the first load
 * after the app opens, or — for rows that appear later (a new month's
 * activity, a pull-to-refresh) — one quick fade with no stagger, so the
 * screen never replays its whole entrance.
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
 * Lists that move: when a row is added, removed or reordered, the rows
 * around it slide to their new place instead of jumping, and a removed row
 * fades out. Short enough to never hold anything up, and off entirely when
 * the phone asks for less motion.
 */
export const ROW_LAYOUT = LinearTransition.duration(DURATIONS.rowMove)
  .easing(MOTION.ease)
  .reduceMotion(ReduceMotion.System);
export const ROW_EXIT = FadeOut.duration(DURATIONS.rowExit).reduceMotion(ReduceMotion.System);

/**
 * A panel opening in place (a Settings row's accordion, archived accounts):
 * it fades in while the rows below it slide down (wrap those in MovingRow),
 * and fades out as they slide back up.
 */
export const PANEL_ENTER = FadeIn.duration(DURATIONS.standard)
  .easing(MOTION.ease)
  .reduceMotion(ReduceMotion.System);
