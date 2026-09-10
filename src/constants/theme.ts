// Yume's visual identity: a hand-drawn "doodle" register — warm cream
// surfaces, thick black outlines on every card, and a soft sage-lime as the
// one signature accent color. The original mockup's lime (#D6FF3D) was a
// near-neon safety-vest chartreuse sitting noticeably darker/more saturated
// than every other flat card color — the one users flagged as hard on the
// eyes across a whole header band or a 2x2 stat grid. Every other flat color
// sits around 74-83% lightness at full saturation, which is what makes them
// read as gentle pastels rather than neon; this lime (and gold, the other
// outlier) were lightened to match that same band instead of getting fixed
// only where they happened to look worst. Every screen reads these tokens
// rather than hardcoding hex values.

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
    // One loud, rarely-used accent for the "Bold Bento" register — a FAB, a
    // small status badge — never a full card fill. Deliberately separate
    // from `accent` (lavender) above, which stays what SectionLabel/etc.
    // already use; this is additive, not a replacement.
    pop: '#FF5B45',

    // A real combination for identity cards (stat tiles, accounts, loan
    // cards) instead of one-of-each-swatch: teal/sage both read as "good
    // news" (income, surplus) — closely related greens, tellable apart but
    // not fighting each other; coral/gold both read as "worth a look"
    // (spend, debt) — adjacent warm tones instead of a hot pink next to a
    // lime green. Each pair is a pale fill plus one deeper same-family tone
    // for an icon circle, never mixed across families on one card.
    idTeal: '#DAF5F0',
    idTealDeep: '#5FB3A8',
    idSage: '#E9F3DA',
    idSageDeep: '#8FBF6B',
    idCoral: '#FFE3D6',
    idCoralDeep: '#F0876A',
    idGold: '#FBF0CE',
    idGoldDeep: '#E0AC3F',

    // A soft warm hairline for the calm card style — separates cards by a
    // thin line and whitespace instead of a thick black border plus offset
    // shadow. `border`/`ink` above stay as they were for buttons, chips,
    // inputs, and modal sheets, which weren't part of this pass.
    borderSoft: '#E6DFC9',
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
  font: {
    display: 'Archivo_700Bold',
    displayBlack: 'Archivo_900Black',
    displayMedium: 'Archivo_600SemiBold',
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
export const ID_PALETTE_DEEP = [
  theme.colors.idGoldDeep,
  theme.colors.idTealDeep,
  theme.colors.idCoralDeep,
  theme.colors.idSageDeep,
];
