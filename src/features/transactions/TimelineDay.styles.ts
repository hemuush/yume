import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';

/** A compact row: its least height. */
export const ROW_H = 48;
// The same 34 dp category mark as Home's Recent activity and every other entry row (SCREEN.iconTile).
export const ICON = SCREEN.iconTile;

export const styles = StyleSheet.create({
  // Each day is a heading line (the day, what it spent) above one card of its entries: no marker rail beside it, so
  // the card runs the full width and the amounts sit near the edge.
  day: { marginHorizontal: 16, marginTop: 12 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 8,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 6,
  },
  // The chart's picked day: its heading sits on a soft tint, pulled out by the 4 dp it gains, so the text stays put.
  headOn: { marginHorizontal: -4, paddingHorizontal: 8, borderRadius: 10 },
  // "Today · Sun 15 Nov": the day in bold ink and the date after it, quieter, as one line that wraps together.
  title: {
    flexGrow: 1,
    flexBasis: 160,
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.textPrimary,
  },
  titleDate: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  // Spending reads in ink with its minus sign; only money in is green.
  total: {
    fontFamily: theme.font.body,
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  lead: { width: ICON, alignItems: 'center', justifyContent: 'center' },
  transferIcon: {
    width: ICON,
    height: ICON,
    borderRadius: ICON / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferName: { fontFamily: theme.font.bodyMedium, color: theme.colors.textSecondary },
  transferAmount: { color: theme.colors.textSecondary },
  // The day's entries sit on a card (the same surface, hairline and corner as Home's list cards), so amounts read
  // on a solid ground instead of straight on the wallpaper.
  lane: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    paddingHorizontal: 14,
  },
  // Starts under the icon, so it separates the text and leaves the icon column unbroken.
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ICON + 10,
    backgroundColor: theme.colors.divider,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 0,
    paddingVertical: 6,
    // A minimum target; text can wrap and measured row heights drive reordering.
    minHeight: ROW_H,
  },
  wrapLine: { flexWrap: 'wrap', rowGap: 6 },
  wideMid: { flexGrow: 1, flexBasis: '75%' },
  mid: { flex: 1, minWidth: 0 },
  stackMid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  stackChip: {
    minHeight: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.colors.surfaceAlt,
  },
  stackCount: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.textSecondary },
  entryHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  name: {
    fontFamily: theme.font.bodyMedium,
    fontSize: theme.typeSize.row,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  stackName: { flexShrink: 1 },
  sub: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  // The right-hand column: the amount over the account it came from, both against the card's right edge.
  side: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '45%', marginLeft: 'auto' },
  amount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    marginLeft: 'auto',
  },
  income: { color: theme.colors.incomeText },
  account: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    color: theme.colors.textMuted,
    textAlign: 'right',
  },
  // An open stack's entries: the same card, dividers and text as every other
  // line, each with a dot in its category's colour under the stack's icon.
  subLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Centre the dot under the category icon; its trailing space aligns the entry text above.
    paddingLeft: (ICON - 6) / 2,
    paddingRight: 0,
    paddingVertical: 5,
    minHeight: 44,
  },
  // Ends where the icon ends, so the text lines up with the lines above.
  subDot: { width: 6, height: 6, borderRadius: 3, marginRight: (ICON - 6) / 2 },
});
