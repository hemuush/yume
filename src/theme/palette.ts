/**
 * Yume's colours as a table per mode. `theme.colors.x` (see `constants/theme.ts`) is the entry of the mode the app is
 * in right now, so a screen keeps reading `theme.colors.ink` and gets the right value in light or dark.
 *
 * This is the first step of the two-mode theme: both modes still hold today's colours, so nothing on screen
 * changes yet. The new light and dark values replace them in the steps that follow.
 */
import { getScheme, type Scheme } from './scheme';

const LIGHT = {
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
  // The colours a split bar gives its parts in turn (Investments' "Where it sits"), pale and distinct.
  splitPalette: ['#8FCBFF', '#F0E1A8', '#8FE8C8', '#E2A6D8', '#F6BFD3', '#BEC8D4'],

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
  // The one grey segment that joins the thin categories in the Reports breakdown bar.
  otherSlice: '#CFC8B6',
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
};

/** Every colour token a screen can read. Each mode's table must give every one a value. */
export type Palette = typeof LIGHT;

export const PALETTES: Record<Scheme, Palette> = {
  light: LIGHT,
  // Dark arrives with the dark palette; until then it is the same table.
  dark: LIGHT,
};

export function getPalette(): Palette {
  return PALETTES[getScheme()];
}
