import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { groupedSurface, screenStyles as h, SCREEN } from '@/components/screenStyles';
import { themedStyles } from '@/theme/themedStyles';

/**
 * Activity's days are drawn from the same measures as Home's Recent activity (RecentTransactionRow and
 * HomeRecentActivity): the same card, 40 dp category disc in a 44 dp slot, name and "category · account" beneath,
 * amount alone at the right, hairline between rows, and the day named inside the card in small capitals. What is
 * Activity's own is below: groups, the drag lift, and the picked day's tint.
 */

/** A row's least height: Home's. */
export const ROW_H = SCREEN.rowMinHeight;

export const styles = themedStyles(() =>
  StyleSheet.create({
    // A day is one cell of the list: its card, with the day named inside it.
    day: { marginTop: 10 },
    // Home's list card. It does not clip (Home's does): a held line is lifted out of the card with a shadow, and a
    // clipped card would cut that off; the rows round their own pressed tint instead.
    lane: {
      marginHorizontal: 16,
      ...groupedSurface.frame,
      overflow: 'visible',
    },
    // The chart's picked day: its heading sits on a soft tint, so the list answers the tap.
    headOn: {
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      backgroundColor: theme.colors.home.selected,
    },
    dayLabel: { ...h.dayHeadText, color: theme.colors.home.secondaryText },
    // Between two lines of the day: across the whole row, as Home's hairline.
    separator: {
      marginLeft: SCREEN.rowInset + SCREEN.lead + 12,
      marginRight: SCREEN.rowInset,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.home.edge,
    },
    lead: { width: SCREEN.lead, alignItems: 'center', justifyContent: 'center' },
    line: {
      ...h.row,
      gap: 12,
      // The pressed tint is a rounded tile, never a square corner over the card's curve.
      borderRadius: theme.radius.md,
    },
    // Large text: the amount wraps under the name.
    wrapLine: { flexWrap: 'wrap', rowGap: 6 },
    wideMid: { flexGrow: 1, flexBasis: '70%' },
    mid: h.mid,
    stackMid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    stackChip: {
      minHeight: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: theme.colors.home.control,
    },
    stackCount: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.textSecondary },
    entryHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    name: h.title,
    stackName: { flexShrink: 1 },
    sub: {
      ...h.sub,
      fontFamily: theme.font.body,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 2,
      color: theme.colors.home.secondaryText,
    },
    // Spending reads in ink with its minus; only money in is green. Never shrunk to fit: an amount that shrinks inside
    // a flex column was once drawn a few dp tall on a phone.
    amount: h.amount,
    income: h.income,
    // An open group's entries: the same row, with a dot in the category's colour where the disc is, so their text
    // lines up with the group's own.
    subLine: { ...h.row, gap: 12, paddingVertical: 6, minHeight: 44, borderRadius: theme.radius.md },
    subLead: { width: SCREEN.lead, alignItems: 'center', justifyContent: 'center' },
    subDot: { width: 6, height: 6, borderRadius: 3 },
  })
);
