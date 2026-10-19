import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { GLASS } from '@/components/Glass';

export const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 12,
    boxShadow: '0px 10px 28px rgba(19,41,63,0.07)',
  },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 32,
  },
  body: { gap: 10 },
  // The figure and today's allowance share a line; the pill wraps under the figure on a narrow screen.
  figureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  figure: { flexShrink: 1, minWidth: 0 },

  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  headIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  headLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  headValue: {
    fontFamily: theme.font.bodyLight,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    lineHeight: 50,
    letterSpacing: -1.6,
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

  // "Details": a link at the end of the caption's line; the touch area is taller than the text (hitSlop).
  captionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10 },
  howLink: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 },
  howText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.link },
  // Names the (often tiny) free part of the money bar.

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.secondaryTint,
    borderWidth: 0,
    maxWidth: '100%',
  },
  chipText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
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
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  stat: {
    flexGrow: 1,
    flexBasis: 100,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 10,
    gap: 3,
    justifyContent: 'center',
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
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.borderSoft },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 15,
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
