import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { themedStyles } from '@/theme/themedStyles';

/**
 * The app's one visual system: every card, section heading and list row is built from these so no block gets
 * its own padding, icon size or type scale (it had drifted: 30/36/38px icons, 11.5-13.5pt row text).
 */
export const SCREEN = {
  /** Space above each section heading (and between a hero card and the block under it). */
  sectionGap: 16,
  gutter: 16,
  /** The side padding a row or a card's content has inside its section. */
  rowInset: 14,
  /** Padding inside a standalone card. */
  cardPad: 12,
  rowMinHeight: 56,
  iconTile: 34,
  /** The slot every list row's leading mark sits in, so titles start at the same place on every row. */
  lead: 44,
  /** A mark inside that slot (date tile, category disc, ring). */
  mark: 40,
  iconGlyph: 16,
} as const;

/**
 * The quiet look's card: no fill, no rounded box, just a hairline above and below. Spread it into a style that used
 * to be a card (inside a `themedStyles` factory), and give the content the 16dp gutter by its padding and margin.
 */
export const flatSection = () =>
  ({
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  }) as const;

export const groupedSurface = themedStyles(() =>
  StyleSheet.create({
    frame: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
  })
);

export const screenStyles = themedStyles(() =>
  StyleSheet.create({
    // The quiet look has no card boxes: a section is rows between two hairlines, on the paper itself. The content
    // keeps the rows' own 14dp inset, so a 2dp margin puts it on the 16dp gutter the headings use.
    card: {
      marginHorizontal: SCREEN.gutter - SCREEN.rowInset,
      backgroundColor: 'transparent',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    // A section inside a sheet, which already has its own side padding.
    cardInSheet: {
      marginHorizontal: 0,
      marginBottom: 12,
      backgroundColor: 'transparent',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
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
    title: {
      fontFamily: theme.font.bodyMedium,
      fontSize: theme.typeSize.row,
      lineHeight: 20,
      color: theme.colors.textPrimary,
    },
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
      fontFamily: theme.font.bodyMedium,
      fontSize: theme.typeSize.row,
      lineHeight: 20,
      color: theme.colors.textPrimary,
    },
    income: { color: theme.colors.incomeText },
    expense: { color: theme.colors.expenseText },
    // A day named inside a list card, above its rows ("TODAY", with what the day spent at the right): Home's Recent
    // activity and Activity's days. After the first, a hairline above it divides it from the day before.
    dayHead: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      columnGap: 8,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 2,
    },
    dayHeadDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
    dayHeadText: { ...EYEBROW, fontFamily: theme.font.bodyBold, fontSize: 11, fontVariant: ['tabular-nums'] },
  })
);
