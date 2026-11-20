// Yume's visual identity, single source of truth: screens read these tokens, never hardcoded values.
// Calm register: cream surfaces, `borderSoft` hairlines, sky-blue `primary` + mint `secondary`, 74-83% pastels.

import { StyleSheet } from 'react-native';
import { getPalette, PALETTES, type Palette } from '@/theme/palette';
import { themedStyles } from '@/theme/themedStyles';

// `theme.colors.x` is the entry of the mode the app is in right now (see `theme/palette.ts` and `theme/scheme.ts`).
// Each token is a getter, so a screen keeps reading `theme.colors.ink` and gets light or dark as the mode changes;
// a style sheet written at module level must be wrapped in `themedStyles` to be made again after a change.
const colors = {} as Readonly<Palette>;
for (const key of Object.keys(PALETTES.light) as (keyof Palette)[]) {
  Object.defineProperty(colors, key, { enumerable: true, get: () => getPalette()[key] });
}

export const theme = {
  colors,
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    // Generous corner for the softer "calm card" register introduced on the
    // Home screen cards — rounder than the doodle cards' `xl`.
    xl2: 28,
    pill: 999,
  },
  // A deliberate, coloured emphasis border (an error banner, an EMI
  // preview). Everything else uses a hairline.
  border: {
    thin: 2,
  },
  spacing: (n: number) => n * 4,
  // The one spacing scale. Gutter and card padding are roles on top of it (see SCREEN in screenStyles).
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
  // Captions stay quiet; readable row text and firmer financial figures provide the hierarchy.
  // The ten sizes of the type scale are 11, 12, 13, 15, 17, 22, 28, 34, 40 and 56; these are the named ones.
  typeSize: { headline: 28, inputAmount: 34, title: 17, greeting: 17, section: 15, row: 15 },
  // How faint a control gets: disabled (a button, row or switch that cannot be used), limit (an arrow or step
  // that has reached the end of its range) and pressed (while a finger is held on it).
  opacity: { disabled: 0.45, limit: 0.35, pressed: 0.6 },
  accessibility: { maxFontScale: 2, reflowFontScale: 1.3, minTouchTarget: 44, lineHeightRatio: 1.4 },
  // Metrics shared with screens that scroll clear of the tab bar: a pushed screen needs `screenScrollPad`
  // bottom padding (callers add `insets.bottom`); a tab screen clears the bar by its height (see uiScale).
  layout: {
    screenScrollPad: 40,
    // Between a screen's header (which already leaves 12 below its title) and
    // the screen's first block — the same 20 in total on every screen.
    screenTopGap: 8,
  },
  font: {
    // Light remains available for secondary screens; primary financial figures use bodyMedium.
    bodyLight: 'Archivo_300Light',
    body: 'Archivo_400Regular',
    bodyMedium: 'Archivo_600SemiBold',
    bodyBold: 'Archivo_700Bold',
    mono: 'SpaceMono_400Regular',
    monoBold: 'SpaceMono_700Bold',
    // Fredoka preserves Yume's character in the wordmark, greeting and screen headers.
    // Functional labels and monetary figures use Archivo; the wordmark and greeting retain Fredoka.
    roundedMedium: 'Fredoka_500Medium',
    roundedBold: 'Fredoka_600SemiBold',
  },
};

// The button block passed as a ModalSheet `footer`: optional error line, Cancel/Save row, optional full-width
// Delete. Shared so every modal's pinned footer lays out the same.
export const modalFooterStyles = themedStyles(() =>
  StyleSheet.create({
    footerCol: { gap: 8 },
    footerRow: { flexDirection: 'row', gap: 8 },
    footerBtn: { flex: 1 },
  })
);

// Every swatch sits in the app's 74-83% lightness pastel band; added colours fill hue gaps (rose, teal, sage,
// tan, mauve, cyan, periwinkle, pale butter) instead of brightening the originals, so the picker stays calm.
export const CATEGORY_COLOR_PALETTE = [
  '#FFA8CE',
  '#8FCBFF',
  '#8FE8C8',
  '#FFD84D',
  '#C9B8FF',
  '#FF9E7D',
  '#7FE0A8',
  '#A8D8FF',
  '#FFC24D',
  '#D8B8FF',
  '#FF8FA3',
  '#8FE0DC',
  '#C5E0A0',
  '#E0C29A',
  '#E0A8C9',
  '#8FE0F0',
  '#A8B8FF',
  '#FFEA9E',
];

// The four flat pastel fills (lime, mint, pink, sky) with ink text/icons directly on them; People's avatar
// tiles pick one by a stable hash of the person's id.
export const flatPalette = (): string[] => [
  theme.colors.flatLime,
  theme.colors.flatMint,
  theme.colors.flatPink,
  theme.colors.flatBlue,
];
