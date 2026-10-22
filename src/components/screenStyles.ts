import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

/**
 * The app's one visual system: every card, section heading and list row is built from these so no block gets
 * its own padding, icon size or type scale (it had drifted: 30/36/38px icons, 11.5-13.5pt row text).
 */
export const SCREEN = {
  /** Space above each section heading (and between a hero card and the block under it). */
  sectionGap: 16,
  gutter: 16,
  /** Padding inside a standalone card. */
  cardPad: 12,
  rowMinHeight: 56,
  iconTile: 34,
  iconGlyph: 16,
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
  // A card inside a sheet, which already has its own side padding.
  cardInSheet: {
    marginHorizontal: 0,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: 22,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: SCREEN.rowMinHeight,
  },
  dividerLeft: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.borderSoft },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  // Same compact footprint as CategoryIcon; same radius ratio (0.32×).
  iconTile: {
    width: SCREEN.iconTile,
    height: SCREEN.iconTile,
    borderRadius: SCREEN.iconTile * 0.32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.font.bodyBold, fontSize: theme.typeSize.row, color: theme.colors.textPrimary },
  sub: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  subUrgent: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },
  subSoon: { fontFamily: theme.font.bodyBold, color: theme.colors.warnInk },
  amount: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: theme.typeSize.row,
    color: theme.colors.textPrimary,
  },
  income: { color: theme.colors.incomeText },
  expense: { color: theme.colors.expenseText },
});
