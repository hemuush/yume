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

## Follow-up, 13 November 2026: what still cut or popped

Asked for "improved animations all over". The calm rule was kept (short fades and glides, nothing draws in, rolls, staggers or springs); the work was to find where something still cut or popped instead of fading, and where motion ran on the JavaScript thread.

- **Content after loading.** Every secondary screen starts on grey placeholders and swapped to its data with a hard cut. The arrived content is now a new view that fades in once on the shared 150 ms content fade (`LoadFade`, or `entering={CONTENT_ENTER}` on the scroll view), while the header and wallpaper stay solid: Budgets, Savings goals, Loans, Recurring, People, Investments, Categories, Category detail, Tidy up, Recently deleted, What-if, Notifications, Notification settings, Profile, and Backup's status card. Card and heading positions were measured in a browser before and after; none moved. `loadFade.test.ts` fails for a screen that shows placeholders and does not fade (Garden, a decorative flow, is left out).
- **Messages that come and go.** `Appear` is the block that fades in, fades out on the row exit and slides when something above it moves, all off with reduce-motion. Every error banner (19 screens), Add's dock status line, its red error line, the repeat warning and the amount card's note use it. `appear.test.ts` fails for a banner drawn as a plain view. **Activity's picked-filter chips were given it too and it was taken off again the same day:** after Clear filters the row stayed scrolled to where it had been and showed a blank strip with the edge of one chip (seen on a device). Removing chips that fade out inside a horizontal scroll view is not safe, so the chips are plain, and the row now brings itself back inside its content whenever the content gets shorter than where it was scrolled to (`ActivityFilterChips.test.tsx`).
- **Nothing on the JavaScript thread** outside the decorative Wrap and Garden flows. `useGrowFrom` was the last one in the product, and its two users (the Trends line and a category's sparkline) passed a constant target, so it never moved anything; both are plain SVG lines now and the hook is gone.

Not changed, and why: the reverse of the calm rule (spring release, bars drawing in on first view, counting figures, staggered entrances) was offered and not chosen. Content below a banner that appears at the top of a screen still shifts at once; only the banner fades. Nothing here has been run on a phone.

