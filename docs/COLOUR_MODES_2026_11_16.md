# Colour modes (light and dark) — engine, 16 November 2026

This is the first step of the single-theme redesign (one minimalist look in a light and a dark mode, replacing the eight accent themes). It builds the part that has to exist before any new colour can be shown: the app can now be drawn in either of two colour tables and switch between them while running. **Nothing on screen changes yet**: both tables still hold today's colours, there is no Appearance control in Settings, and `app.json` still declares `userInterfaceStyle: "light"`. The dark table, the Settings control and the restyle follow in later steps.

## How colours reach a screen

| Piece | Role |
| --- | --- |
| [scheme.ts](../src/theme/scheme.ts) | The mode in use (`light` or `dark`), a version number that goes up each time it changes, and subscribe/apply. `AppearancePreference` is what the person chose: `system`, `light` or `dark`. |
| [palette.ts](../src/theme/palette.ts) | One colour table per mode (`PALETTES`). Every colour token must exist in both. |
| [constants/theme.ts](../src/constants/theme.ts) | `theme.colors.x` is a getter reading the table of the mode in use, so a screen keeps writing `theme.colors.ink` and gets the right value in either mode. |
| [themedStyles.ts](../src/theme/themedStyles.ts) | `themedStyles(() => StyleSheet.create({...}))` makes a style sheet that is rebuilt the first time it is read after the mode changes. `themedValue` is the same for a constant that is not a style sheet. All 183 module-level style sheets use it. |
| [AppearanceContext.tsx](../src/theme/AppearanceContext.tsx) | Decides the mode (the saved choice, or the phone's own setting for `system`) and applies it. The first mode is applied while the first screen is made, so nothing is drawn in the wrong mode and corrected; later changes are applied before the next paint. A restored backup re-reads the saved choice. |
| [SchemeBoundary.tsx](../src/theme/SchemeBoundary.tsx) | `useSchemeVersion()` re-renders a component when the mode changes. `SchemeBoundary` draws its children again from scratch; `schemeScreenLayout` / `stackScreenLayout` put one around every screen through the navigators' `screenLayout`. |
| [AppStatusBar.tsx](../src/theme/AppStatusBar.tsx) | Dark status-bar icons on the light paper, light icons on the dark one. |

The choice is stored in the `settings` table under `appearance` (`getAppearance`, `getCachedAppearance`, `setAppearance` in [settings.ts](../src/db/settings.ts)); a missing or unknown value reads as `system`. Startup reads it with the other preferences so the first screen already uses the right mode; a failed read never holds the app back (it follows the phone).

## What a mode change does to the app

- Each pushed screen is drawn again (its local state starts over; Add's draft recovery keeps what was typed). Navigation is untouched: the same screen stays on top, the screens beneath stay beneath, and Back still works.
- The root stack leaves the screen that holds the tabs alone, so the tab navigator, and the tab the person is on, are not rebuilt. The tabs wrap their own screens, and the tab bar, the status bar, the dialog host, the undo toast, the milestone note, the lock screen, onboarding, the capture-protection screen, the error fallback and the repeat-entry sheet subscribe themselves.
- `AccentProvider` works the text colour on the accent (`onAccent`) out again, because it is derived from the page's ink and surface.

## Rules for new code

- Never read `theme.colors` outside a function, and never call `StyleSheet.create` outside `themedStyles`. Never spread or read a themed constant (`SECTION_TITLE`, a `themedStyles` sheet…) at the top of a file: that copies its colours as they are at load. [liveColours.test.ts](../src/__tests__/liveColours.test.ts) reads every source file and fails on all three.
- Anything memoised from colours above the screens (a provider's `useMemo`) must list `useSchemeVersion()` as a dependency; a screen's own memoised values are rebuilt because the screen is drawn again.
- A literal colour in a style (`'rgba(255,255,255,0.78)'`, a hard-coded hex) is not part of any table and will not change with the mode. Those are the next thing to sweep (see "Left for the next steps").

## Verification (this step)

Run in a browser harness (the real screens on a real SQLite database through react-native-web), not on a device.

- **Light is unchanged:** 22 screens (Home, Activity, Plan, Reports, Add, Profile, Budgets, Goals, Loans, Recurring, People, Investments, Categories, Notifications, Tidy up, Backup, Export, Garden, What-if, Recently deleted, Split, Wrap) rendered before the engine and after it are pixel-identical.
- **No stale colour:** the dark table was replaced by a "poison" table in which every colour is unique and unlike the light one, then each screen was scanned for pixels still showing a light-table colour. That found two real faults, fixed here: a constant spread at the top of `app/loans.tsx` (the "Your loans" heading kept its light colour) and a hard-coded sky in the Reports read marks. The scan also drove the guard test above (it now catches the loans pattern).
- **Live switch:** each screen rendered in light and switched to dark while open matches the same screen rendered directly in dark, apart from antialiasing on one rounded card edge in Plan and Reports (about 30 pixels) and People's randomly generated avatar colours. That comparison found one more real fault, fixed here: the letter in the profile avatar kept the old colour because `onAccent` was memoised in a provider above the screens.
- **Router:** [schemeNavigation.test.tsx](../src/theme/schemeNavigation.test.tsx) runs the real Expo Router with the same layouts and checks the tab is drawn again but the tab navigator is not, a pushed screen is drawn again and Back still returns to the same tab, and re-applying the same mode touches nothing. It fails if the layouts are removed.
- **Unit tests:** scheme, palette, themed styles, the provider (9), startup with an unreadable appearance, the accent text colour, the guard test and the full suite.

Not verified here: a real phone (Android's own dark-mode switch, the system navigation bar), and animation during a switch.

## Left for the next steps

- A real dark table (the placeholder equals light), then the Appearance control in Settings, `userInterfaceStyle: "automatic"`, the navigation-bar icon style and the launch/loading screens following the mode.
- Literal colours not in a table: translucent whites in `Glass`, the tab bar, Garden, What-if, Reports and Budgets styles; shadows and hairlines written as `rgba(18,19,15,…)`; the one-off tones in `ReportInsights`; widgets and the PDF/Excel export (those keep their own light palettes).
- The accent themes (`themes.ts`, `AccentContext`) still supply the accent and `DEFAULT_ACCENT` still seeds the avatar and header colours; the single-theme step removes them.
