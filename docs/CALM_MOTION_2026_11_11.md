# Calm motion — 11 November 2026

Replaces the "longer, softer" direction of [MOTION_POLISH_2026_11_11.md](MOTION_POLISH_2026_11_11.md). The aim is neat, minimal and smooth everywhere: things fade or glide to a new state, and never rise, roll, stagger or bounce.

## The rule

- Durations are short (`src/lib/motionTimings.ts`): quick 150, standard 200, slide-in 220, section 200, row move 200, row exit 150, draw 240 ms. One ease-out curve for entrances and moves, an ease-in for exits.
- Nothing draws in from empty. Bars, rings and chart lines show their value at once and glide only when the value really changes (`useDrawnValue`, `useGrowFrom`).
- Nothing counts or rolls. `CountUpAmount` is now a plain money `Text`: a figure changes at once. It no longer runs a JavaScript animation that re-measured auto-fit text every frame; that work was the likeliest cause of screens feeling heavy when the month changed.
- No stagger. Home sections and rows arrive with one plain fade (the first open a touch longer); Plan, Reports and Activity content swaps are a 150 ms fade with no rise (`CONTENT_ENTER`).
- Press feedback is the original quick dip: 80 ms in, 120 ms out, no spring.
- The Home capsules show at their height; the picked one still lifts. The heatmap cells no longer fade in one by one.
- The tab pill fades its fill and slides its row; it no longer scales in.
- Sheets still rise, but 16 pt over 220 ms; the toast rises 16 pt.
- Screens open the same way everywhere: the standard slide. The card-grow transition (a card expanding into Budgets, Savings goals and Category detail) and its overlay (`CardGrowHost`, `cardGrow`) were removed.
- Everything still turns off with the phone's reduce-motion setting.

## Not changed

Interactions that answer a tap or a drag (tapping a Home month slice, the picked capsule's lift, swipes, the collapsing header), list add/remove sliding, panels opening, the loading shimmer, and the decorative Wrap and Garden flows.

## Checks

`tsc`, eslint, prettier, the cycle check and `npm test` pass. Tests that asserted the old behaviour (rolling figures, drawing in from zero, the press spring) were rewritten to assert the new one. Nothing here has been run on a phone: the real check is how it feels on a device.
