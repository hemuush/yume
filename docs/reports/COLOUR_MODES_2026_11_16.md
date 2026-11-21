# The quiet look and colour modes — 16 November 2026

One theme, in a light and a dark mode, replaces the six accent themes and the coloured, frosted look. The direction was chosen on a design canvas (direction "A": flat and quiet, ink-filled selection, the sky and coral of the logo, Fredoka titles, a floating white tab bar with a coral Add dot) and built in four steps. This page records what the code does now, the rules for new code, how it was checked, and what is not done.

## What changed on screen

- **Palette.** Paper `#FEFBF1`, white surface, warm hairlines, ink `#16170F`, the logo's sky `#9EC5FC` as the lead colour, coral `#FC7B5E` as the only warm accent (the Add button and the "free to spend" arc). Dark is the warm near-black `#12130F` with lifted text and status colours and deep tints. Both tables are in [palette.ts](../../src/theme/palette.ts); `theme.colors.x` reads the table of the mode in use.
- **Flat page.** No wallpaper, no header wash, no sheet wash. Cards are not boxes: `flatSection()` ([screenStyles.ts](../../src/components/screenStyles.ts)) is a hairline above and below, with the content on the 16dp gutter (2dp margin + the rows' 14dp inset). Plan's tiles, Home's accounts (now a name-over-balance strip), "Needs attention" lines and Profile's account tiles are hairline rows. `Glass` is a plain block; `GLASS` tokens are white controls with a hairline edge.
- **Type and controls.** Every text size is one of ten: 11, 12, 13, 15, 17, 22, 28, 34, 40, 56. Header titles are Fredoka 34 on a tab's own screen and 28 on a pushed one (collapsing to 18). The ink of buttons, picked chips, switches and links is the page's own ink (near-black, cream in dark), not a tinted accent. Plan, Reports and Profile switch parts with plain text tabs and an ink underline ([UnderlineTabs](../../src/components/UnderlineTabs.tsx)); the segmented control and pill tabs are a warm track with a raised white segment; the tab bar is a white pill with a coral Add dot; category discs are one neutral tone with line icons where the icon font has one; progress bars are one ink (red only once over a limit) and a budget's pace is a coral dot; the amount keypad is plain digits with no key boxes; the week bars are solid sky with the picked day in blue; Home's month is a large ring (flat colours: grey spent, blue set aside, sky bills, coral free) with its four slices as rows under it.
- **Dark mode.** Settings › Appearance › Colour mode (System, Light, Dark). `shade()` mirrors its lightness in dark (a pale tint becomes a deep wash), and text on an ink fill uses `onInk`, so ink fills (primary buttons, picked chips, the undo toast) invert with readable text. `app.json` has `userInterfaceStyle: "automatic"` and a dark launch screen; the status bar, the navigation-bar icons and the window colour follow the app's mode ([AppStatusBar](../../src/theme/AppStatusBar.tsx)).
- **One theme.** The Themes screen, the six accent packs, the theme card in Settings and the "match the app icon" choice are gone. [AccentContext](../../src/theme/AccentContext.tsx) is a hook returning the sky, mint, coral and the text colour on the sky. Opening the database deletes the old `theme_id`, `accent_color` and `theme_app_icon` rows; the widgets take the logo colours from [brand.ts](../../src/theme/brand.ts). The launcher aliases stay in the build only so a phone that had picked a theme icon is put back to Yume's own icon ([appIcon.ts](../../src/lib/appIcon.ts)).

## How colours reach a screen

| Piece | Role |
| --- | --- |
| [scheme.ts](../../src/theme/scheme.ts) | The mode in use, a version that goes up on each change, subscribe/apply, `schemeChangedJustNow`. `AppearancePreference` is `system`, `light` or `dark`. |
| [palette.ts](../../src/theme/palette.ts) | One table per mode; every token must exist in both. |
| [themedStyles.ts](../../src/theme/themedStyles.ts) | `themedStyles(() => StyleSheet.create({...}))` is rebuilt the first time it is read after the mode changes; `themedValue` is the same for a constant. |
| [AppearanceContext.tsx](../../src/theme/AppearanceContext.tsx) | Decides the mode (the saved choice or the phone's) and applies it before the first screen is made; sits above the spinner and the start-up error. A restored backup re-reads the choice. |
| [SchemeBoundary.tsx](../../src/theme/SchemeBoundary.tsx) | `useSchemeVersion()`, `SchemeBoundary`, and the `screenLayout`s that draw each pushed screen and each tab again on a change while the navigators and the selected tab stay put. |
| [useKeptAcrossModeChange.ts](../../src/theme/useKeptAcrossModeChange.ts) | Keeps a small choice (the tab on Profile, Plan, Reports) across that redraw, and only then. |

The saved choice is the `appearance` setting (a missing or unknown value reads as `system`); start-up reads it with the other preferences and a failed read never holds the app back.

## Rules for new code

- Never read `theme.colors` outside a function, never call `StyleSheet.create` outside `themedStyles`, and never spread or read a themed constant at the top of a file: [liveColours.test.ts](../../src/__tests__/liveColours.test.ts) fails on all three.
- Text or an icon on an ink fill uses `theme.colors.onInk`, never `white` or a literal. Tints derived from the accent use `shade()`/`softTint()`, never a literal. A literal colour in a style is not part of either table and will not change with the mode.
- Anything memoised from colours above the screens (a provider's `useMemo`) must depend on `useSchemeVersion()`; a screen's own memoised values are rebuilt because the screen is drawn again.
- A new card is a `flatSection()`, not a box.

## Verification

Browser harness (the real screens on a real SQLite database through react-native-web), not a device.

- **Engine, light unchanged:** before any colour changed, 22 screens rendered before and after the engine were pixel-identical.
- **Stale colours:** a "poison" dark table (every colour unique) found a constant spread at the top of `app/loans.tsx`, a hard-coded sky in the Reports read marks and the text colour on the accent memoised above the screens; all fixed and the guard test extended.
- **Dark and live switch:** all 22 screens were rendered in dark and reviewed; each screen switched live from light to dark matches the same screen rendered directly in dark (apart from People's randomly generated avatar colours and ~6 antialiased pixels in Reports). The real Colour mode control was clicked in the real Profile screen; the tab stayed on Settings.
- **Alignment:** the left edge of every text on the 17 main screens was measured against the 16dp gutter after the sections were flattened.
- **Router:** [schemeNavigation.test.tsx](../../src/theme/schemeNavigation.test.tsx) runs the real Expo Router with the app's layouts: the tab is drawn again but the tab navigator is not, a pushed screen is drawn again and Back returns to the same tab; it fails without the layouts.
- **Tests:** the full suite, typecheck and lint pass; contrast tests run over both tables (text on page, card, warm surface and tray; text on ink; the lines; the moon slices).

Not verified: a real phone (Android's own dark-mode switch, the navigation-bar icon style, the dark launch screen, the launcher-icon reset), animation during a switch, and the widgets (they keep their own light palette).

## Also changed on 16 November, after the first write-up

- The "your own emoji" field of the category form is removed and the icon picker is the full built-in list again (94 icons, 24 shown and the rest under "Browse all icons"); an emoji a category already has is still drawn and kept. See [the emoji page](CATEGORY_EMOJI_2026_11_15.md).

## Not done

- The "free after bills" line above Save on Add: it needs the same month balance Home shows (carry, income, spending, savings, bills still to pay), which today is worked out inside Home's data hook; reading it again inside the Add flow would be a second copy of money logic, so it needs a shared read first.
- Home still has the brand row and date above the greeting, and Add keeps its "Add" title (the canvas says "New entry").
- The 44/40 tap-target rule was checked on the browser render (one small control fixed); a full pass with a finger on a phone is still open.
- Literal colours left on purpose or not yet reviewed: Frost chips' translucent greens/ambers/reds, Wrap and Garden tile pastels, the one-off tones in `ReportInsights`, account/category data colours.
- The widgets and the PDF/Excel export keep light palettes of their own.
- The six launcher aliases and their art (`assets/theme-icons`, `scripts/generateThemeIcons.py`, the native splash themes) can be removed in a later native build once no phone needs the reset.
