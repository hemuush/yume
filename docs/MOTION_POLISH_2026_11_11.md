# Motion polish — 2026-11-11

What changed, so behaviour descriptions stay aligned with the code:

- `src/lib/motionTimings.ts`: durations lengthened (quick 180, standard 240, slideIn 280, draw 420, count 320, rowMove 260 …); `EASE_OUT` is the shared bezier(0.22, 1, 0.36, 1) for core-`Animated` code. `MOTION.ease` in `animation.ts` is the same curve for Reanimated.
- `usePressScale`: press-in 90 ms, release is a soft `Animated.spring`.
- `ModalSheet`: standalone sheets and dialogs rise 28 pt over `slideIn` while the backdrop fades; pages inside a SheetFlow do not animate this way.
- `CONTENT_ENTER` (`animation.ts`): the one fade-and-rise used when Plan/Reports/Activity tab content or a report detail swaps.
- Reduce-motion still turns all of this off. Not a fresh test run: 32 date-dependent tests fail on `main` too.
