import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { screenStyles as h } from '@/components/screenStyles';
import { themedStyles } from '@/theme/themedStyles';

/**
 * Activity’s days are drawn from the same measures as Home’s Recent activity (RecentTransactionRow’s compact row and
 * HomeRecentActivity): the same card, a 32 dp category disc in its own slot, name and “category · account” beneath,
 * amount alone at the right, a hairline between rows that starts under the name, and the day named inside the card in
 * small capitals. What is Activity’s own is below: groups, the drag lift, and the picked day’s tint.
 */

/** The category disc, and the slot it sits in. */
export const MARK = 32;
/** The side padding of a row (and of the day’s heading, so the two line up). */
const INSET = 12;
/** Between the disc and the text. */
const GAP = 8;
/** A row’s least height: Home’s compact row. */
export const ROW_H = 48;

export const styles = themedStyles(() =>
  StyleSheet.create({
    // A day is one cell of the list: its card, with the day named inside it.
    day: { marginTop: 8 },
    // Home’s list card (its Coming up and Recent activity). It does not clip (Home’s does): a held line is lifted out
    // of the card with a shadow, and a clipped card would cut that off; the rows round their own pressed tint instead.
    lane: {
      marginHorizontal: 16,
      backgroundColor: theme.colors.home.surface,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
      overflow: 'visible',
    },
    dayHead: { ...h.dayHead, paddingHorizontal: INSET },
    // The chart’s picked day: its heading sits on a soft tint, so the list answers the tap.
    headOn: {
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      backgroundColor: theme.colors.home.selected,
    },
    dayLabel: { ...h.dayHeadText, color: theme.colors.home.secondaryText },
    // Between two lines of the day: from under the name to the row’s end, as on Home.
    separator: {
      marginLeft: INSET + MARK + GAP,
      marginRight: INSET,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.home.edge,
    },
    lead: { width: MARK, alignItems: 'center', justifyContent: 'center' },
    line: {
      ...h.row,
      minHeight: ROW_H,
      paddingVertical: 8,
      paddingHorizontal: INSET,
      gap: GAP,
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
    subLine: {
      ...h.row,
      gap: GAP,
      paddingVertical: 6,
      paddingHorizontal: INSET,
      minHeight: 44,
      borderRadius: theme.radius.md,
    },
    subLead: { width: MARK, alignItems: 'center', justifyContent: 'center' },
    subDot: { width: 6, height: 6, borderRadius: 3 },
  })
);
