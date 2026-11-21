/**
 * Yume's colours as a table per mode. `theme.colors.x` (see `constants/theme.ts`) is the entry of the mode the app is
 * in right now, so a screen keeps reading `theme.colors.ink` and gets the right value in light or dark.
 */
import { getScheme, type Scheme } from './scheme';

const LIGHT = {
  background: '#F1F4FB',
  surface: '#FFFFFF',
  surfaceAlt: '#E8EDF8',
  home: {
    background: '#F1F4FB',
    surface: '#FFFFFF',
    control: '#E9EEFA',
    selected: '#D9E4FA',
    pressed: '#C8D8F6',
    edge: '#DCE3F2',
    secondaryText: '#46506F',
  },

  ink: '#0C1230',
  // The fill of buttons, the picked pill or tab, switches and progress: the ink on paper, the logo's sky on the dark.
  action: '#0C1230',
  // The colour of text or an icon on an ink fill (a picked chip, the dark toast): the paper itself.
  onInk: '#F1F4FB',
  inkSoft: '#46506F',

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
  onCoral: '#0C1230',

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

  textPrimary: '#0C1230',
  textSecondary: '#46506F',
  textMuted: '#5F6A8A', // 4.5:1+ on card, page and surfaceAlt

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
  borderSoft: '#E0E6F3',
  // A fainter line for dividers inside a card (Home's legend, the glance card's rows).
  divider: '#E8EDF7',

  // One disc colour per Plan collection (Plan at a glance); the glyph on it is `onFlat`, dark in both modes.
  collection: { budgets: '#9EC5FC', goals: '#8FE8C8', investments: '#C9B8FF', debt: '#FC7B5E' },
  // Home's month slices, one colour per meaning everywhere they appear (ring, legend dots, meters).
  // Equal-lightness pastels so no slice shouts over another; they are fills only, never text.
  slice: {
    spent: '#8B8D99', // warm grey: money already gone is quiet
    saved: '#4F86D9', // set aside: the blue
    due: '#9EC5FC', // bills still to pay: the sky
    free: '#FC7B5E', // free to spend: the coral dot of the logo
    debt: '#BBA9F7',
  },
  // The "still to pay" family: the chip and date tile, a paler row behind a bill due soon, and its text.
  dueTint: '#E8EDF8',
  dueRow: '#FBF7EA',
  dueInk: '#7A5100',
  // The soft tray under the month card's figures (Today, pace) and its meter track.
  tray: '#EAEFFA',
  // The chosen pill of a segmented switch: raised above its tray, white on paper and a lighter slate on the dark.
  pill: '#FFFFFF',
  trayTrack: '#D9E1F3',
  // The one grey segment that joins the thin categories in the Reports breakdown bar.
  otherSlice: '#C3CCE0',
  // Readable sky for links and the transfer icon: 5.6:1 on the card, 5:1 on the page.
  link: '#2D5DB0',

  // Ink at very low opacity — a faint fill for inactive tracks, weekend
  // cells, and other "barely there" surfaces on a cream ground.
  inkWash: 'rgba(12,18,48,0.05)',
  // Ink at a little more opacity — a hairline on a translucent chip.
  inkHairline: 'rgba(12,18,48,0.1)',
  // A clearer ink line for rails and rings that must read on cream (a timeline rail, a dot's ring), ~1.9:1.
  inkLine: 'rgba(12,18,48,0.16)',
  // Ink for an "off" state or a faint chart line that still has to be seen (~1.9:1 on the card).
  inkOff: 'rgba(12,18,48,0.28)',
  // White at partial opacity — a frosted chip or figure sitting on a
  // pastel card, letting the card's colour show through.
  glass: 'rgba(255,255,255,0.6)',
  // The dimmed backdrop behind every sheet and dialog: warm ink, light
  // enough that you still see where you were (calm sheets).
  scrim: 'rgba(12,18,48,0.3)',
};

/** Every colour token a screen can read. Each mode's table must give every one a value. */
export type Palette = typeof LIGHT;

/**
 * The dark mode: graphite canvas in layers (page, card, tray, control), each a step lighter than the one below, with the logo's sky for what is selected. Text and the lead colours are
 * lifted (the sky and the coral stay the logo's; green, red and amber are the lighter shades that read on dark),
 * tints become deep washes, and edges separate adjacent layers. Pastel fills used for category and account
 * marks stay pastel, with dark ink on them.
 */
const DARK: Palette = {
  background: '#0A0E17',
  surface: '#192133',
  surfaceAlt: '#212B3F',
  home: {
    background: '#0A0E17',
    surface: '#192133',
    control: '#2A3652',
    selected: '#2B4770',
    pressed: '#34567F',
    edge: '#32405F',
    secondaryText: '#C2CADB',
  },

  ink: '#F1F4FA',
  action: '#9EC5FC',
  onInk: '#0B1533',
  inkSoft: '#B8C0D2',

  primary: '#9EC5FC',
  primaryTint: '#233851',
  secondary: '#8FE8C8',
  secondaryTint: '#223D3A',
  secondaryDeep: '#4FD0A0',
  accent: '#C9B8FF',
  accentTint: '#2F2C49',
  gold: '#F0E1A8',
  goldTint: '#3B3224',

  coral: '#FC7B5E',
  onCoral: '#0C1230',

  income: '#6FD6A5',
  incomeTint: '#233A34',
  expense: '#FF8F8A',
  expenseTint: '#442D35',
  incomeText: '#6FD6A5',
  expenseText: '#FF8F8A',
  warnInk: '#E8B84A',

  textPrimary: '#F1F4FA',
  textSecondary: '#B8C0D2',
  textMuted: '#9AA5BC',

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
  spentSoft: '#8B8D99',
  idGold: '#2E2A1A',
  idGoldDeep: '#E0AC3F',
  splitPalette: ['#9EC5FC', '#F0E1A8', '#8FE8C8', '#E2A6D8', '#F6BFD3', '#BEC8D4'],

  borderSoft: '#2B3650',
  divider: '#222B40',

  // One disc colour per Plan collection (Plan at a glance); the glyph on it is `onFlat`, dark in both modes.
  collection: { budgets: '#9EC5FC', goals: '#8FE8C8', investments: '#C9B8FF', debt: '#FC7B5E' },
  slice: {
    spent: '#8C96AD',
    saved: '#7AA2F0',
    due: '#9EC5FC',
    free: '#FC7B5E',
    debt: '#BBA9F7',
  },
  dueTint: '#3A3021',
  dueRow: '#302A23',
  dueInk: '#E8B84A',
  tray: '#1C2538',
  pill: '#303E5E',
  trayTrack: '#36425C',
  otherSlice: '#5C667D',
  link: '#9EC5FC',

  inkWash: 'rgba(255,255,255,0.06)',
  inkHairline: 'rgba(255,255,255,0.12)',
  inkLine: 'rgba(255,255,255,0.18)',
  inkOff: 'rgba(255,255,255,0.3)',
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
