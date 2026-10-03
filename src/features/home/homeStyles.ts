import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SOFT_LIFT } from './SoftCard';

/**
 * Home's one visual system: every card, section heading and list row is built from these so no block gets
 * its own padding, icon size or type scale (it had drifted: 30/36/38px icons, 11.5-13.5pt row text).
 */
export const HOME = {
  /** Space above each section heading. */
  sectionGap: 26,
  gutter: 20,
  rowMinHeight: 62,
  iconTile: 38,
  iconGlyph: 17,
} as const;

export const homeStyles = StyleSheet.create({
  card: {
    marginHorizontal: HOME.gutter,
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
    paddingVertical: 11,
    paddingHorizontal: 14,
    minHeight: HOME.rowMinHeight,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  // Same shape and size as CategoryIcon's default (38px, radius 0.32×).
  iconTile: {
    width: HOME.iconTile,
    height: HOME.iconTile,
    borderRadius: HOME.iconTile * 0.32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  subUrgent: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },
  subSoon: { fontFamily: theme.font.bodyBold, color: theme.colors.warnInk },
  amount: { fontFamily: theme.font.monoBold, fontSize: 13.5, color: theme.colors.textPrimary },
  income: { color: theme.colors.incomeText },
  expense: { color: theme.colors.expenseText },
});
