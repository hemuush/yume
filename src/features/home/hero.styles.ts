import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  // The two Home cards sit on the page as plain surfaces: no border, a whisper of shadow.
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    boxShadow: '0px 1px 2px rgba(18,19,15,0.04), 0px 14px 34px -16px rgba(18,19,15,0.14)',
  },
  rhythm: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderRadius: 28,
    backgroundColor: theme.colors.surface,
    boxShadow: '0px 1px 2px rgba(18,19,15,0.04), 0px 14px 34px -16px rgba(18,19,15,0.14)',
  },
  actions: { marginHorizontal: 16, marginTop: 12 },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 32,
  },
  body: { gap: 2 },
  figure: { flexShrink: 1, minWidth: 0, marginTop: 4 },

  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  headLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  headValue: {
    fontFamily: theme.font.bodyLight,
    fontSize: 56,
    fontVariant: ['tabular-nums'],
    lineHeight: 62,
    letterSpacing: -2.4,
    color: theme.colors.textPrimary,
  },
  headSymbol: {
    fontFamily: theme.font.body,
    fontSize: 24,
    letterSpacing: 0,
    color: theme.colors.textMuted,
  },
  headValueNeg: { color: theme.colors.expenseText },
  headCaption: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },

  // The info control keeps a full-size touch target beside the label.
  howLink: { alignItems: 'center', justifyContent: 'center', width: 44, minHeight: 44, borderRadius: 22 },
  howLinkOn: { backgroundColor: theme.colors.tray },

  // The month as one line: spent, saved, bills and free, in the colours the legend below uses.
  line: { flexDirection: 'row', gap: 3, height: 10, marginTop: 18 },
  lineSegment: { height: 10, borderRadius: 5, minWidth: 4 },

  // Three columns under the line: each dot is the line's colour, so the line is the legend.
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  stat: {
    flexGrow: 1,
    flexBasis: 100,
    minWidth: 0,
    minHeight: 56,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 3,
  },
  statStack: {
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statLabel: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyMedium,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },

  // Today's allowance: what is left, with a thin meter under it.
  today: { minHeight: 44, paddingTop: 6, paddingBottom: 12, gap: 10 },
  todayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  todayFigure: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  todayFigureOver: { color: theme.colors.expenseText },
  todayRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.trayTrack,
  },
  todayFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.slice.free },
  todayFillOver: { backgroundColor: theme.colors.slice.spent },
  chipText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },

  trend: { gap: 0 },
  trendBelowToday: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    paddingTop: 10,
  },
  insightsLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  insightsText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.link },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },

  working: {
    marginTop: 6,
    borderRadius: 18,
    backgroundColor: theme.colors.tray,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  workingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 5,
  },
  workingTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    marginTop: 3,
    paddingTop: 8,
  },
  workingLabel: {
    flexGrow: 1,
    flexBasis: 140,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  workingLabelTotal: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  workingValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  workingValueDue: { color: theme.colors.dueInk },
});
