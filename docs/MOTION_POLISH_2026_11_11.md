# Motion polish — 2026-11-11

What changed, so behaviour descriptions stay aligned with the code:

- `src/lib/motionTimings.ts`: durations lengthened (quick 180, standard 240, slideIn 280, draw 420, count 320, rowMove 260 …); `EASE_OUT` is the shared bezier(0.22, 1, 0.36, 1) for core-`Animated` code. `MOTION.ease` in `animation.ts` is the same curve for Reanimated.
- `usePressScale`: press-in 90 ms, release is a soft `Animated.spring`.
- `ModalSheet`: standalone sheets and dialogs rise 28 pt over `slideIn` while the backdrop fades; pages inside a SheetFlow do not animate this way.
- `CONTENT_ENTER` (`animation.ts`): the one fade-and-rise used when Plan/Reports/Activity tab content or a report detail swaps.
- Reduce-motion still turns all of this off. Not a fresh test run: 32 date-dependent tests fail on `main` too.

Follow-up audit:

- Every Reanimated entrance now names the shared curve; exits (`ROW_EXIT`, toast, milestone note) use `MOTION.exit`, an ease-in that speeds away.
- Undo toast rises 16 pt instead of travelling its full height; heatmap cells fade on the shared curve.
- Skeleton shimmer sweeps linearly (1400 ms) so neighbouring skeletons no longer pulse in and out of step.
- Left as is: height-driven animation of Home capsules and month segments (small, one-off layouts).

Screen-by-screen pass:

- Every core-`Animated` timing (toggle knob, fade-in hook, completion card, loan wizard fill) now uses `EASE_OUT`; the card-grow transition (Budgets, Savings goals, Category) uses `MOTION.ease` and runs 300 ms.
- Reviewed with no further change needed: secondary screens (Backup, Categories, People, Themes, Recurring, Investments, Notifications, Export, Tidy up, What-if, Split) only scroll with the collapsing header and press-scale controls; Budgets, Goals and Loans lists use `MovingRow`; Settings/You/Tracked panels use `PANEL_ENTER`/`ROW_EXIT`.
- Not touched: Wrap and Garden (decorative, own timings).

Audit pass (read each motion file):

- Confirmed Reanimated accepts `Easing.bezier` (factory) in `withTiming` and layout-animation builders.
- Confirmed no view mixes core `Animated` styles with Reanimated entering/layout props.
- `GrowFill` animates width (kept: scaling would squash its rounded ends).
- No web target exists, so nothing here has been run in a real renderer; feel is unchecked on device.
