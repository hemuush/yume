// Yume's visual identity, single source of truth: screens read these tokens, never hardcoded values.
// Calm register: cream surfaces, `borderSoft` hairlines, sky-blue `primary` + mint `secondary`, 74-83% pastels.

import { StyleSheet } from 'react-native';

export const theme = {
  colors: {
    background: '#F1EDE2',
    surface: '#FFFDF8',
    surfaceAlt: '#F3ECE0',

    ink: '#12130F',
    inkSoft: '#5B5748',

    // Sky-blue is the signature accent: the same value as `flatBlue` (account tags), promoted to the lead role.
    primary: '#8FCBFF',
    primaryTint: '#EAF3FE',
    secondary: '#8FE8C8', // mint
    secondaryTint: '#E4FAF1',
    // A deeper mint for a thin edge on a small mint dot (Home's Saved tile).
    secondaryDeep: '#2FB98A',
    accent: '#C9B8FF', // lavender
    accentTint: '#F1ECFF',
    gold: '#F0E1A8',
    goldTint: '#FBF3E0',

    income: '#1C9A5B',
    incomeTint: '#DDF2E5',
    expense: '#E23F55',
    expenseTint: '#FBE1E4',
    // Deeper income/expense shades for text and numbers under ~18px; the livelier pair above is for icons,
    // bars and dots only (under 4.5:1 on the cream surfaces).
    incomeText: '#167747',
    expenseText: '#BD3547',
    // Amber for warning text and small icons: idGoldDeep is ~2:1 on the cream
    // surfaces, so it stays for fills (bars, tints) only.
    warnInk: '#8A5A00',

    textPrimary: '#12130F',
    textSecondary: '#5B5748',
    textMuted: '#6C685B', // 4.5:1+ on card, page and surfaceAlt

    white: '#FFFFFF',
    flatLime: '#E0F0A8',
    flatMint: '#8FE8C8',
    flatPink: '#FFA8CE',
    flatBlue: '#8FCBFF',
    onFlat: '#12130F',

    // Identity-card tones: teal/sage (income, surplus) and coral/gold (spend, debt) are related families, pale
    // fills; coral and gold also have a deeper tone for icon circles or figures. Never mix families on a card.
    idTeal: '#DAF5F0',
    idSage: '#E9F3DA',
    idCoral: '#FFE3D6',
    idCoralDeep: '#F0876A',
    // The "spent" side of Home's moon — a step deeper than idCoral so it holds
    // its own next to the mint and sky slices (signed off with the moon hero).
    spentSoft: '#F6A88E',
    idGold: '#FBF0CE',
    idGoldDeep: '#E0AC3F',

    // A soft warm hairline for the calm card style, separating cards by a thin line and whitespace.
    // This is the default edge for cards, chips, inputs and sheets; `border` (ink) is the rare exception.
    borderSoft: '#E8E1D1',
    // A fainter line for dividers inside a card (Home's legend, the glance card's rows).
    divider: '#F0EADD',

    // Home's month slices, one colour per meaning everywhere they appear (ring, legend dots, meters).
    // Equal-lightness pastels so no slice shouts over another; they are fills only, never text.
    slice: {
      spent: '#F6A88E',
      saved: '#4FD09F',
      due: '#EDB02F',
      free: '#7DB9F2',
      debt: '#BBA9F7',
    },
    // The "still to pay" family: the chip and date tile, a paler row behind a bill due soon, and its text.
    dueTint: '#FCEFC9',
    dueRow: '#FDF7E8',
    dueInk: '#7A5100',
    // The soft tray under the month card's figures (Today, pace) and its meter track.
    tray: '#F8F3EA',
    trayTrack: '#ECE4D4',
    // Readable sky for links and the transfer icon: 5.6:1 on the card, 5:1 on the page.
    link: '#2A69A6',

    // Ink at very low opacity — a faint fill for inactive tracks, weekend
    // cells, and other "barely there" surfaces on a cream ground.
    inkWash: 'rgba(18,19,15,0.05)',
    // Ink at a little more opacity — a hairline on a translucent chip.
    inkHairline: 'rgba(18,19,15,0.1)',
    // A clearer ink line for rails and rings that must read on cream (a timeline rail, a dot's ring), ~1.9:1.
    inkLine: 'rgba(18,19,15,0.16)',
    // Ink for an "off" state or a faint chart line that still has to be seen (~1.9:1 on the card).
    inkOff: 'rgba(18,19,15,0.28)',
    // White at partial opacity — a frosted chip or figure sitting on a
    // pastel card, letting the card's colour show through.
    glass: 'rgba(255,255,255,0.6)',
    // The dimmed backdrop behind every sheet and dialog: warm ink, light
    // enough that you still see where you were (calm sheets).
    scrim: 'rgba(18,19,15,0.3)',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 14,
    xl: 18,
    // Generous corner for the softer "calm card" register introduced on the
    // Home screen cards — rounder than the doodle cards' `xl`.
    xl2: 22,
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
  // Compact sizing keeps Yume's existing fonts and hierarchy. Text elsewhere follows the same ladder: 11 for axis
  // and legend text, 12 captions, 13 body and row titles, 14-15 emphasis, then these.
  typeSize: { hero: 34, headline: 30, inputAmount: 40, title: 18, greeting: 16, section: 15, row: 13 },
  accessibility: { maxFontScale: 2, reflowFontScale: 1.3, minTouchTarget: 44, lineHeightRatio: 1.4 },
  // Metrics shared with screens that scroll clear of the tab bar: a pushed screen needs `screenScrollPad`
  // bottom padding (callers add `insets.bottom`); a tab screen clears the bar by its height (see uiScale).
  layout: {
    // The floating pill tab bar (PillTabBar): its 60 height plus the 10 gap under it.
    tabBar: { height: 70 },
    screenScrollPad: 40,
    // Between a screen's header (which already leaves 12 below its title) and
    // the screen's first block — the same 20 in total on every screen.
    screenTopGap: 8,
  },
  font: {
    // Light, for Home's big glass-card figures only.
    bodyLight: 'Archivo_300Light',
    body: 'Archivo_400Regular',
    bodyMedium: 'Archivo_600SemiBold',
    bodyBold: 'Archivo_700Bold',
    mono: 'SpaceMono_400Regular',
    monoBold: 'SpaceMono_700Bold',
    // Fredoka, a rounded face for Home's warmer register: wordmark, section titles, hero headings.
    // Body copy stays Archivo and amounts stay Space Mono.
    roundedMedium: 'Fredoka_500Medium',
    roundedBold: 'Fredoka_600SemiBold',
  },
};

// The button block passed as a ModalSheet `footer`: optional error line, Cancel/Save row, optional full-width
// Delete. Shared so every modal's pinned footer lays out the same.
export const modalFooterStyles = StyleSheet.create({
  footerCol: { gap: 8 },
  footerRow: { flexDirection: 'row', gap: 8 },
  footerBtn: { flex: 1 },
});

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
export const FLAT_PALETTE = [
  theme.colors.flatLime,
  theme.colors.flatMint,
  theme.colors.flatPink,
  theme.colors.flatBlue,
];
