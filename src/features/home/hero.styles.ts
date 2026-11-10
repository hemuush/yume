import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { screenStyles as h } from '@/components/screenStyles';

export const styles = StyleSheet.create({
  // Keep Home's cream surface and quiet edge consistent with the rest of the app.
  card: { ...h.card, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 8,
  },
  // The week's spending, in its own card under the Add buttons.
  rhythm: { ...h.card, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  lineHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: 8,
    marginTop: 14,
  },
  lineHeadText: { fontFamily: theme.font.body, fontSize: 11, lineHeight: 16, color: theme.colors.textMuted },
  dayTick: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 20,
    marginLeft: -1,
    borderRadius: 2,
    backgroundColor: theme.colors.ink,
  },
  actions: { marginHorizontal: 16, marginTop: 10 },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 32,
  },
  body: { gap: 2 },
  figure: { flexShrink: 1, minWidth: 0, marginTop: 2 },

  headLabel: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  headValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    lineHeight: 52,
    letterSpacing: -0.8,
    color: theme.colors.textPrimary,
  },
  headValueNeg: { color: theme.colors.expenseText },
  headCaption: {
    flexShrink: 1,
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
  },

  howLink: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 },
  howLinkText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },

  // The month as one line: spent, saved, bills and free, in the colours the legend below uses.
  line: { flexDirection: 'row', gap: 3, height: 12 },
  lineWrap: { marginTop: 6 },
  lineOrigin: { transformOrigin: 'left center' },
  lineSegment: { height: 12, borderRadius: 6, minWidth: 5 },

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
