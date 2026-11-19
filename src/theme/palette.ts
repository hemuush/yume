/**
 * Yume's colours as a table per mode. `theme.colors.x` (see `constants/theme.ts`) is the entry of the mode the app is
 * in right now, so a screen keeps reading `theme.colors.ink` and gets the right value in light or dark.
 */
import { getScheme, type Scheme } from './scheme';

const LIGHT = {
  background: '#FEFBF1',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F1E3',
  entry: {
    background: '#FAF7EF',
    surface: '#FFFFFF',
    control: '#EDF2FA',
    selected: '#DFECFC',
    edge: '#D9E1EC',
    secondaryText: '#505B6C',
    keySurface: '#F5F1E8',
  },
  home: {
    background: '#FAF7EF',
    surface: '#FFFFFF',
    control: '#EDF2FA',
    selected: '#E0ECFC',
    pressed: '#D3E4FB',
    edge: '#DCE3ED',
    secondaryText: '#505B6C',
  },

  ink: '#16170F',
  // The colour of text or an icon on an ink fill (a picked chip, the dark toast): the paper itself.
  onInk: '#FEFBF1',
  inkSoft: '#55564B',

  // Sky-blue is the signature accent: the same value as `flatBlue` (account tags), promoted to the lead role.
  primary: '#9EC5FC',
  primaryTint: '#E4EDFB',
  secondary: '#8FE8C8', // mint
  secondaryTint: '#E4FAF1',
  // A deeper mint for a thin edge on a small mint dot (Home's Saved tile).
  secondaryDeep: '#2FB98A',
  accent: '#C9B8FF', // lavender
  accentTint: '#F1ECFF',
  gold: '#F0E1A8',
  goldTint: '#FBF3E0',

  // The logo's dot: the Add button and the "free to spend" arc, the only warm accent.
  coral: '#FC7B5E',

  income: '#1B7A4F',
  incomeTint: '#DDF2E5',
  expense: '#B3261E',
  expenseTint: '#FBE1E4',
  // Deeper income/expense shades for text and numbers under ~18px; the livelier pair above is for icons,
  // bars and dots only (under 4.5:1 on the cream surfaces).
  incomeText: '#1B7A4F',
  expenseText: '#B3261E',
  // Amber for warning text and small icons: idGoldDeep is ~2:1 on the cream
  // surfaces, so it stays for fills (bars, tints) only.
  warnInk: '#8A5A00',

  textPrimary: '#16170F',
  textSecondary: '#55564B',
  textMuted: '#6A6B5F', // 4.5:1+ on card, page and surfaceAlt

  white: '#FFFFFF',
  flatLime: '#E0F0A8',
  flatMint: '#8FE8C8',
  flatPink: '#FFA8CE',
  flatBlue: '#9EC5FC',
  onFlat: '#12130F',

  // Identity-card tones: teal/sage (income, surplus) and coral/gold (spend, debt) are related families, pale
  // fills; coral and gold also have a deeper tone for icon circles or figures. Never mix families on a card.
  idTeal: '#DAF5F0',
  idSage: '#E9F3DA',
  idCoral: '#FFE3D6',
  idCoralDeep: '#FC7B5E',
  // The "spent" side of Home's moon — a step deeper than idCoral so it holds
  // its own next to the mint and sky slices (signed off with the moon hero).
  spentSoft: '#F6A88E',
  idGold: '#FBF0CE',
  idGoldDeep: '#E0AC3F',
  // The colours a split bar gives its parts in turn (Investments' "Where it sits"), pale and distinct.
  splitPalette: ['#9EC5FC', '#F0E1A8', '#8FE8C8', '#E2A6D8', '#F6BFD3', '#BEC8D4'],

  // A soft warm hairline for the calm card style, separating cards by a thin line and whitespace.
  // This is the default edge for cards, chips, inputs and sheets; `border` (ink) is the rare exception.
  borderSoft: '#EAE4D2',
  // A fainter line for dividers inside a card (Home's legend, the glance card's rows).
  divider: '#EFE9D8',

  // Home's month slices, one colour per meaning everywhere they appear (ring, legend dots, meters).
  // Equal-lightness pastels so no slice shouts over another; they are fills only, never text.
  slice: {
    spent: '#8F8C7C', // warm grey: money already gone is quiet
    saved: '#4F86D9', // set aside: the blue
    due: '#9EC5FC', // bills still to pay: the sky
    free: '#FC7B5E', // free to spend: the coral dot of the logo
    debt: '#BBA9F7',
  },
  // The "still to pay" family: the chip and date tile, a paler row behind a bill due soon, and its text.
  dueTint: '#F6F1E3',
  dueRow: '#FBF7EA',
  dueInk: '#7A5100',
  // The soft tray under the month card's figures (Today, pace) and its meter track.
  tray: '#F8F3EA',
  trayTrack: '#ECE4D4',
  // The one grey segment that joins the thin categories in the Reports breakdown bar.
  otherSlice: '#CFC8B6',
  // Readable sky for links and the transfer icon: 5.6:1 on the card, 5:1 on the page.
  link: '#2D5DB0',

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
};

/** Every colour token a screen can read. Each mode's table must give every one a value. */
export type Palette = typeof LIGHT;

/**
 * The dark mode: the same tokens on the warm near-black paper of the approved design. Text and the lead colours are
 * lifted (the sky and the coral stay the logo's; green, red and amber are the lighter shades that read on dark),
 * tints become deep washes, and lines are barely lighter than the page. Pastel fills used for category and account
 * marks stay pastel, with dark ink on them.
 */
const DARK: Palette = {
  background: '#12130F',
  surface: '#1A1B16',
  surfaceAlt: '#24251E',
  entry: {
    background: '#22262F',
    surface: '#2B313C',
    control: '#3A4557',
    selected: '#3B5678',
    edge: '#525D70',
    secondaryText: '#D2DBE9',
    keySurface: '#232933',
  },
  home: {
    background: '#202733',
    surface: '#282E39',
    control: '#303B4C',
    selected: '#344D6C',
    pressed: '#3B5474',
    edge: '#465368',
    secondaryText: '#D0D8E4',
  },

  ink: '#F6F2E6',
  onInk: '#12130F',
  inkSoft: '#B9B7AB',

  primary: '#9EC5FC',
  primaryTint: '#1F2B40',
  secondary: '#8FE8C8',
  secondaryTint: '#1D2F29',
  secondaryDeep: '#4FD0A0',
  accent: '#C9B8FF',
  accentTint: '#2A2540',
  gold: '#F0E1A8',
  goldTint: '#332E1C',

  coral: '#FC7B5E',

  income: '#6FD6A5',
  incomeTint: '#1D2E26',
  expense: '#FF8F8A',
  expenseTint: '#3B2A24',
  incomeText: '#6FD6A5',
  expenseText: '#FF8F8A',
  warnInk: '#E8B84A',

  textPrimary: '#F6F2E6',
  textSecondary: '#B9B7AB',
  textMuted: '#97958A',

  white: '#FFFFFF',
  flatLime: '#E0F0A8',
  flatMint: '#8FE8C8',
  flatPink: '#FFA8CE',
  flatBlue: '#9EC5FC',
  onFlat: '#12130F',

  idTeal: '#1B2B28',
  idSage: '#222A1B',
  idCoral: '#33241F',
  idCoralDeep: '#FC7B5E',
  spentSoft: '#8F8C7C',
  idGold: '#2E2A1A',
  idGoldDeep: '#E0AC3F',
  splitPalette: ['#9EC5FC', '#F0E1A8', '#8FE8C8', '#E2A6D8', '#F6BFD3', '#BEC8D4'],

  borderSoft: '#2E2F27',
  divider: '#26271F',

  slice: {
    spent: '#6E6D62',
    saved: '#7AA2F0',
    due: '#9EC5FC',
    free: '#FC7B5E',
    debt: '#BBA9F7',
  },
  dueTint: '#24251E',
  dueRow: '#1F201A',
  dueInk: '#E8B84A',
  tray: '#1F201A',
  trayTrack: '#2E2F27',
  otherSlice: '#4A4A40',
  link: '#9EC5FC',

  inkWash: 'rgba(246,242,230,0.06)',
  inkHairline: 'rgba(246,242,230,0.12)',
  inkLine: 'rgba(246,242,230,0.18)',
  inkOff: 'rgba(246,242,230,0.3)',
  glass: 'rgba(255,255,255,0.08)',
  scrim: 'rgba(0,0,0,0.55)',
};

export const PALETTES: Record<Scheme, Palette> = {
  light: LIGHT,
  dark: DARK,
};

export function getPalette(): Palette {
  return PALETTES[getScheme()];
}
