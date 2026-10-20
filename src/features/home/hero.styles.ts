import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { GLASS } from '@/components/Glass';

export const styles = StyleSheet.create({
  trend: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    paddingTop: 8,
    marginTop: 6,
    gap: 0,
  },
  insightsLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  insightsText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.link },
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 4,
    borderWidth: 0,
    boxShadow: 'none',
  },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 32,
  },
  body: { gap: 3 },
  // One figure and its calculation disclosure; long amounts can wrap the disclosure below.
  figureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  figure: { flexShrink: 1, minWidth: 0 },

  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  headLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  headValue: {
    fontFamily: theme.font.body,
    fontSize: 36,
    fontVariant: ['tabular-nums'],
    lineHeight: 42,
    letterSpacing: -1.6,
    color: theme.colors.textPrimary,
  },
  headSymbol: {
    fontFamily: theme.font.body,
    fontSize: 20,
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

  // The info control keeps a full-size touch target beside the balance.
  howLink: { alignItems: 'center', justifyContent: 'center', width: 44, minHeight: 44 },
  // Names the (often tiny) free part of the money bar.

  dailyFooter: {
    minHeight: 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 0,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 0,
    maxWidth: '100%',
  },
  chipText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  // The today chip clips a thin meter along its bottom edge.
  chipClip: { overflow: 'hidden' },
  chipMeter: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 3,
    backgroundColor: theme.colors.slice.free,
  },
  chipOver: { borderColor: 'rgba(189,53,71,0.28)', backgroundColor: 'rgba(226,63,85,0.06)' },
  chipTextOver: { color: theme.colors.expenseText },

  // Three columns straight under the bar, no panel of their own: each dot is the bar's colour, so the bar is the legend.
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 100,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 4,
  },
  statStack: {
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 0,
    paddingHorizontal: 0,
  },
  statFirst: { paddingLeft: 0 },
  statDivider: { borderLeftWidth: 0 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot: { width: 5, height: 5, borderRadius: 3 },
  statLabel: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },

  working: {
    borderRadius: 16,
    backgroundColor: GLASS.fillStrong,
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
