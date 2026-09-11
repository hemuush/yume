// Yume's visual identity, single source of truth. Every screen reads these
// tokens rather than hardcoding hex values, radii, or font names — change a
// value here and it changes everywhere.
//
// The current register is a calm, minimal one: warm cream surfaces, thin
// hairline borders (`borderSoft`) and whitespace to separate cards, pill
// shapes for nav/buttons/chips, and a soft sage-lime (`primary`) plus mint
// (`secondary`) as the signature accents. All flat/pastel swatches sit in a
// 74-83% lightness band so they read as gentle pastels, never neon.
//
// A heavier "doodle" layer still exists under this — thick ink borders
// (`border.thin`/`border.thick`) and the hard offset shadow (`shadowOffset`,
// rendered by NeoTile) — and is still used by the loans, transactions and
// recurring cards that the minimal pass hasn't reached yet. New UI should
// prefer the hairline/pill register above.

import { StyleSheet } from 'react-native';

export const theme = {
  colors: {
    background: '#EDE7D6',
    surface: '#FFFDF6',
    surfaceAlt: '#F3ECE0',
    border: '#12130F', // borders are always the ink color — thickness is what varies

    ink: '#12130F',
    inkSoft: '#5B5748',

    primary: '#E0F0A8', // soft sage-lime — the one signature accent
    primaryTint: '#F4F7E6',
    secondary: '#8FE8C8', // mint
    secondaryTint: '#E4FAF1',
    accent: '#C9B8FF', // lavender
    accentTint: '#F1ECFF',
    gold: '#F0E1A8',
    goldTint: '#FBF3E0',

    income: '#1C9A5B',
    incomeTint: '#DDF2E5',
    expense: '#E23F55',
    expenseTint: '#FBE1E4',

    textPrimary: '#12130F',
    textSecondary: '#5B5748',
    textMuted: '#948E7C',

    white: '#FFFFFF',
    flatLime: '#E0F0A8',
    flatMint: '#8FE8C8',
    flatPink: '#FFA8CE',
    flatBlue: '#8FCBFF',
    onFlat: '#12130F',

    // Identity-card tones (stat tiles, accounts, loan cards): teal/sage read
    // as "good news" (income, surplus) — closely related greens; coral/gold
    // read as "worth a look" (spend, debt) — adjacent warm tones. Each is a
    // pale fill; coral and gold also carry a deeper same-family tone for an
    // icon circle or an emphasised figure. Never mixed across families on
    // one card.
    idTeal: '#DAF5F0',
    idSage: '#E9F3DA',
    idCoral: '#FFE3D6',
    idCoralDeep: '#F0876A',
    idGold: '#FBF0CE',
    idGoldDeep: '#E0AC3F',

    // A soft warm hairline for the calm card style — separates cards by a
    // thin line and whitespace instead of a thick black border plus offset
    // shadow. `border`/`ink` above stay as they were for buttons, chips,
    // inputs, and modal sheets, which weren't part of this pass.
    borderSoft: '#E6DFC9',

    // Ink at very low opacity — a faint fill for inactive tracks, weekend
    // cells, and other "barely there" surfaces on a cream ground.
    inkWash: 'rgba(18,19,15,0.05)',
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 14,
    xl: 18,
    // Generous corner for the softer "calm card" register introduced on the
    // Home screen (SoftCard) — rounder than the doodle cards' `xl`.
    xl2: 22,
    pill: 999,
  },
  // Every card/button/chip border is thick and black (the doodle look) —
  // components pull from here instead of hardcoding a width.
  border: {
    thin: 2,
    thick: 3,
  },
  // A hard, un-blurred offset shadow (rendered as a solid ink shape behind
  // the card via NeoTile, not a native shadow prop) is what separates a
  // confident neobrutalist card from a flat one with just a border.
  shadowOffset: 4,
  spacing: (n: number) => n * 4,
  // Layout metrics shared between the tab bar and the screens that must
  // scroll clear of it. The tab bar is docked flush to the bottom edge —
  // `tabBar.height` tall, `tabBar.topRadius` rounding only its top corners —
  // with the device's safe-area inset added as its own bottom padding rather
  // than left as empty page below it. A scrolling tab screen therefore needs
  // `tabScreenScrollPad` of bottom padding (bar height + a comfortable
  // margin) so its last row is never hidden; a plain pushed screen with no
  // tab bar only needs `screenScrollPad`. Every caller adds `insets.bottom`
  // on top of both.
  layout: {
    tabBar: { height: 58, topRadius: 20 },
    tabScreenScrollPad: 58 + 24,
    screenScrollPad: 40,
  },
  font: {
    body: 'Archivo_400Regular',
    bodyMedium: 'Archivo_600SemiBold',
    bodyBold: 'Archivo_700Bold',
    mono: 'SpaceMono_400Regular',
    monoBold: 'SpaceMono_700Bold',
    // Fredoka — a rounded, friendly face used for the Home screen's warmer
    // register: the brand wordmark, section titles, and hero headings. Body
    // copy stays Archivo and amounts stay Space Mono.
    rounded: 'Fredoka_400Regular',
    roundedMedium: 'Fredoka_500Medium',
    roundedBold: 'Fredoka_600SemiBold',
  },
};

// The outlined settings/preferences row card — identical across
// settings.tsx and notification-settings.tsx, kept as one definition instead
// of two copies that could quietly drift apart.
export const settingsRowStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 12,
  marginHorizontal: 20,
  marginBottom: 8,
  backgroundColor: theme.colors.surface,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: theme.colors.borderSoft,
  borderRadius: theme.radius.lg,
  padding: 12,
};

// The action-button block passed as a ModalSheet `footer` — a column that
// can hold an optional error line, the Cancel/Save row, and an optional
// full-width Delete. Shared so every modal's pinned footer lays out the same.
export const modalFooterStyles = StyleSheet.create({
  footerCol: { gap: 8 },
  footerRow: { flexDirection: 'row', gap: 8 },
  footerBtn: { flex: 1 },
});

// Every swatch sits in the same 74-83%-lightness pastel band described up
// top — added colors were picked to fill gaps in hue coverage (rose, teal,
// sage, tan, mauve, cyan, periwinkle, a paler butter yellow) rather than
// just brightening/darkening the originals, so a bigger picker still reads
// as one calm family instead of drifting toward neon or mud.
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

// Flat, high-saturation "block" colors — solid card fills with black
// text/icons directly on them (account cards, summary pills).
export const FLAT_PALETTE = [
  theme.colors.flatLime,
  theme.colors.flatMint,
  theme.colors.flatPink,
  theme.colors.flatBlue,
];

// The calm identity-card palette, pale step only, for cycling across a list
// of same-kind things (accounts) that have no inherent good/bad meaning —
// deliberately just these four, not a wider rainbow.
export const ID_PALETTE = [
  theme.colors.idGold,
  theme.colors.idTeal,
  theme.colors.idCoral,
  theme.colors.idSage,
];

// Reports spend-heatmap intensity ramp — a 5-step translucent coral scale
// indexed by `HeatCell.level` (0 = no spend that day, 4 = heaviest). Used by
// both the heatmap cells (SpendHeatmap) and the "less → more" legend
// (reports.tsx), so the two can never drift apart.
export const SPEND_HEAT_SCALE = [
  'transparent',
  'rgba(224,126,95,0.16)',
  'rgba(224,126,95,0.36)',
  'rgba(214,84,54,0.62)',
  'rgba(196,64,42,0.92)',
] as const;
// The matching cell-label colour per level — dark ink on the two palest
// steps, white once the wash is dark enough to carry it.
export const SPEND_HEAT_TEXT = [
  theme.colors.textMuted,
  theme.colors.textMuted,
  theme.colors.textSecondary,
  theme.colors.white,
  theme.colors.white,
] as const;
