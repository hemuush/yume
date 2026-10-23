import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { screenStyles as h } from '@/components/screenStyles';

export const styles = StyleSheet.create({
  // The two Home cards are the app's one card (screenStyles.card): cream, rounded, a hairline edge, no shadow.
  card: { ...h.card, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 8,
  },
  rhythm: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft, marginTop: 0 },
  actions: { marginHorizontal: 16, marginTop: 12 },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 32,
  },
  glow: { position: 'absolute', right: -80, top: -100 },
  body: { gap: 2 },
  figure: { flexShrink: 1, minWidth: 0, marginTop: 2 },

  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  headLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  headValue: {
    fontFamily: theme.font.bodyLight,
    fontSize: theme.typeSize.headline,
    fontVariant: ['tabular-nums'],
    lineHeight: 40,
    letterSpacing: -1.1,
    color: theme.colors.textPrimary,
  },
  headSymbol: {
    fontFamily: theme.font.body,
    fontSize: 22,
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
  line: { flexDirection: 'row', gap: 3, height: 10 },
  lineWrap: { marginTop: 16 },
  lineOrigin: { transformOrigin: 'left center' },
  lineSegment: { height: 10, borderRadius: 5, minWidth: 5 },

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
