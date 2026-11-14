import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SECTION_TITLE } from '@/constants/textStyles';
import { SCREEN } from '@/components/screenStyles';

/** A compact row: its least height. */
export const ROW_H = 48;
// The same 34 dp category mark as Home's Recent activity and every other entry row (SCREEN.iconTile).
export const ICON = SCREEN.iconTile;

export const styles = StyleSheet.create({
  // Each day is a flat block on the page: a marker rail on the left (weekday, date, a line down to the next
  // day) and the day's heading and entries beside it.
  day: { marginHorizontal: 16, marginTop: 14, flexDirection: 'row', gap: 12 },
  rail: { width: 44, alignItems: 'center', paddingTop: 8 },
  railWeekday: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    color: theme.colors.textMuted,
  },
  // Minimum, not fixed, so the date number is never clipped at large text sizes.
  railNumber: { minWidth: 34, minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  railNumberToday: {
    minWidth: 34,
    minHeight: 34,
    paddingHorizontal: 6,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railNumberText: {
    fontFamily: theme.font.bodyBold,
    fontVariant: ['tabular-nums'],
    fontSize: 18,
    color: theme.colors.textPrimary,
  },
  railNumberTextToday: { color: theme.colors.white },
  railLine: { flex: 1, width: 2, marginTop: 6, borderRadius: 1, backgroundColor: theme.colors.divider },
  dayBody: { flex: 1, minWidth: 0 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 2,
  },
  title: {
    flexGrow: 1,
    flexBasis: 160,
    // A quiet day label: the section heading's face at row-caption size.
    ...SECTION_TITLE,
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
  },
  titleOn: { fontFamily: theme.font.bodyBold, color: theme.colors.ink },
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
