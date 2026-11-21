> The motion rules this checklist was written against changed: see [CALM_MOTION_2026_11_11.md](CALM_MOTION_2026_11_11.md). The per-file inventory of what animates is still accurate; the durations and presets it names are not.

# Motion checklist — every screen and component (2026-11-11)

Generated from a scan of every `.tsx` under `app/` and `src/` (281 files, 76 with motion), then reviewed. Each motion item is checked against the same six rules:

1. Shared curve (`MOTION.ease` / `EASE_OUT`; exits `MOTION.exit`) — no ad-hoc easing
2. Duration from `DURATIONS` (or intentional, noted)
3. Honours OS reduce-motion
4. Runs on the native/UI thread (JS-driven only where noted)
5. No layout-thrash (transform/opacity preferred)
6. Press feedback ≤ 3% scale, release springs back

`[x]` = verified in code/tests. `[ ]` = needs a look on a real phone (feel can't be judged from code).

## Global

- [x] Tab switch: cross-fade, `DURATIONS.quick`, off with reduce-motion (`app/(tabs)/_layout.tsx`)
- [x] Stack push/pop: slide_from_right 260 ms; grow routes (Budgets, Goals, Category) use card-grow 300 ms; Wrap fades
- [x] Sheets/dialogs: backdrop and surface fade together (the Modal's own fade); no entering animation on the surface (`ModalSheet`, guarded by `sheetSurface.test.ts`); flow pages excluded
- [x] Toast / milestone note: rise 16 pt in, ease-in out
- [x] Pill tab bar: fill bloom, layout slide, label fade, press scale
- [x] Skeleton: linear 1.4 s sweep, frozen under reduce-motion
- [ ] On-device feel check of the whole flow (Android + iOS), at 1× and 1.3× font size


## `app/(tabs)/add.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/(tabs)/index.tsx`

- [x] Screen itself: 5× entrance, 1× exit, layout slide
- [x] `src/features/home/AccountSummarySheet.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/features/home/HeroActions.tsx` — press feedback (scale+dim, spring release)
- [x] `src/features/home/HomeComingUp.tsx` — 1× entrance, layout slide — reduce-motion via shared constant, shared easing ✓
- [x] `src/features/home/HomeHeader.tsx` — 1× entrance — reduce-motion ✓, shared easing ✓
- [x] `src/features/home/HomeRow.tsx` — press feedback (scale+dim, spring release)
- [x] `src/features/home/MonthRing.tsx` — still ring, no animation — reduce-motion ✓, shared easing ✓
- [x] `src/features/home/MonthPill.tsx` — press feedback (scale+dim, spring release)
- [x] `src/features/home/SpendBars.tsx` — 1× entrance, 1× exit, timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/features/home/SuuRefreshBadge.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/features/home/ThisMonthHero.tsx` — 1× entrance, 1× exit, layout slide, timed/spring animation, count-up figures — reduce-motion ✓, shared easing ✓

## `app/(tabs)/plan.tsx`

- [x] Screen itself: 1× entrance
- [x] `src/features/loans/AddLoanModal.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/features/plan/PlanGoals.tsx` — press feedback (scale+dim, spring release)
- [x] `src/features/plan/PlanTiles.tsx` — press feedback (scale+dim, spring release)

## `app/(tabs)/reports.tsx`

- [x] Screen itself: 1× entrance
- [x] `src/features/reports/CashFlowCard.tsx` — count-up figures, draw/grow fill
- [x] `src/features/reports/CategoryList.tsx` — draw/grow fill
- [x] `src/features/reports/CategoryTracks.tsx` — draw/grow fill
- [x] `src/features/reports/DayInspector.tsx` — 1× entrance — reduce-motion via shared constant, shared easing ✓
- [x] `src/features/reports/ReportHero.tsx` — count-up figures
- [x] `src/features/reports/ReportTrends.tsx` — 1× entrance — reduce-motion via shared constant, shared easing ✓
- [x] `src/features/reports/SpendHeatmap.tsx` — 2× entrance — reduce-motion ✓, shared easing ✓
- [x] `src/features/reports/TrendChart.tsx` — draw/grow fill

## `app/(tabs)/transactions.tsx`

- [x] Screen itself: press feedback (scale+dim, spring release), 1× entrance
- [x] `src/features/transactions/SpendBarChart.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/features/transactions/TimelineDay.tsx` — 1× entrance — reduce-motion via shared constant, shared easing ✓
- [x] `src/features/transactions/TransactionsHeadline.tsx` — timed/spring animation, count-up figures — reduce-motion ✓, shared easing n/a

## `app/add-transaction.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/backup.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/budgets.tsx`

- [x] `src/features/budgets/BudgetRow.tsx` — press feedback (scale+dim, spring release)
- [x] `src/features/budgets/BudgetsHero.tsx` — count-up figures

## `app/categories.tsx`

- [x] `src/features/categories/CategorySection.tsx` — press feedback (scale+dim, spring release)

## `app/category/[id].tsx`

- [x] `src/features/budgets/BudgetRow.tsx` — press feedback (scale+dim, spring release)
- [x] `src/features/transactions/TransactionRow.tsx` — press feedback (scale+dim, spring release)

## `app/export.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/garden.tsx`

- [x] `src/features/garden/GardenPlant.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓; JS-driven on purpose (text/width value), throttled

## `app/investments.tsx`

- [x] `src/features/home/AccountSummarySheet.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/features/investments/InvestmentsHero.tsx` — count-up figures

## `app/loans.tsx`

- [x] `src/features/loans/AddLoanModal.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/features/loans/LoanCard.tsx` — press feedback (scale+dim, spring release), count-up figures, draw/grow fill
- [x] `src/features/loans/LoansHero.tsx` — count-up figures, draw/grow fill

## `app/notification-settings.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/notifications.tsx`

- [x] `src/features/home/NeedsYouRow.tsx` — press feedback (scale+dim, spring release)

## `app/people.tsx`

- [x] `src/features/people/PersonTile.tsx` — press feedback (scale+dim, spring release), 1× exit, layout slide — reduce-motion ✓, shared easing ✓

## `app/profile.tsx`

- [x] `src/features/profile/CashHero.tsx` — count-up figures
- [x] `src/features/profile/SettingsSection.tsx` — 3× entrance, 3× exit — reduce-motion via shared constant, shared easing ✓
- [x] `src/features/profile/TrackedCard.tsx` — 1× entrance, 1× exit — reduce-motion via shared constant, shared easing ✓
- [x] `src/features/profile/YouSection.tsx` — 1× entrance, 1× exit — reduce-motion via shared constant, shared easing ✓

## `app/recently-deleted.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/recurring.tsx`

- [x] `src/features/recurring/RuleRow.tsx` — 1× exit, layout slide — reduce-motion via shared constant, shared easing ✓

## `app/savings-goals.tsx`

- [x] `src/features/goals/GoalCard.tsx` — count-up figures
- [x] `src/features/goals/GoalsHero.tsx` — count-up figures, draw/grow fill

## `app/split.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/themes.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/tidy-up.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/whatif.tsx`

- [x] No screen-specific motion; scroll + collapsing header + shared press/tab/stack transitions only

## `app/wrap.tsx`

- [x] `src/features/wrap/WrapBeatPrimitives.tsx` — timed/spring animation — reduce-motion via shared constant, shared easing ✓
- [x] `src/features/wrap/WrapBeats.tsx` — timed/spring animation, count-up figures — reduce-motion via shared constant, shared easing ✓; JS-driven on purpose (text/width value), throttled
- [x] `src/features/wrap/WrapCharts.tsx` — timed/spring animation — reduce-motion via shared constant, shared easing ✓; JS-driven on purpose (text/width value), throttled
- [x] `src/features/wrap/WrapPlayer.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓; JS-driven on purpose (text/width value), throttled

## Shared components (used by many screens) and anything not under a route

- [x] `src/components/ActionSheet.tsx` — press feedback (scale+dim, spring release)
- [x] `src/components/AddButton.tsx` — press feedback (scale+dim, spring release)
- [x] `src/components/AmountPad.tsx` — press feedback (scale+dim, spring release)
- [x] `src/components/AppHeader.tsx` — press feedback (scale+dim, spring release)
- [x] `src/components/CalendarSheet.tsx` — press feedback (scale+dim, spring release)
- [x] `src/components/CardGrowHost.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/components/CategoryPicker.tsx` — press feedback (scale+dim, spring release)
- [x] `src/components/Chip.tsx` — press feedback (scale+dim, spring release)
- [x] `src/components/CompletionCard.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/components/CountUpAmount.tsx` — timed/spring animation, count-up figures — reduce-motion ✓, shared easing ✓; JS-driven on purpose (text/width value), throttled
- [x] `src/components/Frost.tsx` — draw/grow fill
- [x] `src/components/GrowFill.tsx` — draw/grow fill
- [x] `src/components/JustAddedGlow.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/components/LimitMeter.tsx` — draw/grow fill
- [x] `src/components/MilestoneNote.tsx` — 1× entrance, 1× exit — reduce-motion ✓, shared easing ✓
- [x] `src/components/ModalSheet.tsx` — press feedback (scale+dim, spring release), 2× entrance — reduce-motion ✓, shared easing ✓
- [x] `src/components/MovingRow.tsx` — 1× exit, layout slide — reduce-motion via shared constant, shared easing ✓
- [x] `src/components/PillTabBar.tsx` — press feedback (scale+dim, spring release), 1× entrance, layout slide, timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/components/PrimaryButton.tsx` — press feedback (scale+dim, spring release), 1× entrance — reduce-motion ✓, shared easing ✓
- [x] `src/components/ProgressRing.tsx` — draw/grow fill
- [x] `src/components/Section.tsx` — press feedback (scale+dim, spring release)
- [x] `src/components/SegmentedControl.tsx` — press feedback (scale+dim, spring release), timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/components/SettingsRow.tsx` — press feedback (scale+dim, spring release)
- [x] `src/components/Skeleton.tsx` — timed/spring animation, looping — reduce-motion ✓, shared easing n/a; loop is intentionally steady/linear; stops with reduce-motion
- [x] `src/components/SuuIllustration.tsx` — timed/spring animation, looping — reduce-motion ✓, shared easing n/a; loop is intentionally steady/linear; stops with reduce-motion
- [x] `src/components/ToggleSwitch.tsx` — timed/spring animation — reduce-motion ✓, shared easing ✓
- [x] `src/components/UndoToast.tsx` — press feedback (scale+dim, spring release), 1× entrance, 1× exit — reduce-motion ✓, shared easing ✓

## Known deliberate exceptions

- Home capsules / month segments animate height (small one-off layouts; scale would distort rounded ends)
- `CountUpAmount`, Wrap and Garden use JS-driven timing (text values / decorative)
- Wrap and Garden keep their own timings

