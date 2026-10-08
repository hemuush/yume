import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SOFT_LIFT } from './SoftCard';

/**
 * The app's one visual system: every card, section heading and list row is built from these so no block gets
 * its own padding, icon size or type scale (it had drifted: 30/36/38px icons, 11.5-13.5pt row text).
 */
export const SCREEN = {
  /** Space above each section heading (and between a hero card and the block under it). */
  sectionGap: 24,
  gutter: 20,
  /** Padding inside a standalone card; a hero card with a top strip takes `heroPadTop`. */
  cardPad: 16,
  heroPadTop: 20,
  /** Between cards stacked in a list. */
  cardStack: 12,
  rowMinHeight: 64,
  iconTile: 40,
  iconGlyph: 17,
} as const;

export const screenStyles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN.gutter,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  // The main Home cards: the same card, lifted like the month card.
  cardLifted: { ...SOFT_LIFT },
  // A card inside a sheet, which already has its own side padding.
  cardInSheet: { marginHorizontal: 0, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: SCREEN.rowMinHeight,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  // A touch larger than CategoryIcon's default (38px); same radius ratio (0.32×).
  iconTile: {
    width: SCREEN.iconTile,
    height: SCREEN.iconTile,
    borderRadius: SCREEN.iconTile * 0.32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  subUrgent: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },
  subSoon: { fontFamily: theme.font.bodyBold, color: theme.colors.warnInk },
  amount: { fontFamily: theme.font.monoBold, fontSize: 15, color: theme.colors.textPrimary },
  income: { color: theme.colors.incomeText },
  expense: { color: theme.colors.expenseText },
});
