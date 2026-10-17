import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { GLASS } from '@/components/Glass';

export const styles = StyleSheet.create({
  card: { marginHorizontal: 16, padding: 14, gap: 10 },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 32,
  },
  body: { gap: 10 },

  headLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  headValue: {
    fontFamily: theme.font.bodyLight,
    fontSize: theme.typeSize.hero,
    fontVariant: ['tabular-nums'],
    lineHeight: 42,
    letterSpacing: -1.2,
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
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textSecondary,
  },

  // "How this adds up": a link under the caption; the touch area is taller than the text (hitSlop).
  // Pulled up under the caption (the card's gap is 10) so the link does not add a row of its own.
  howLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    minHeight: 24,
    marginTop: -6,
    marginBottom: -2,
  },
  howText: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.link },
  // Names the (often tiny) free part of the money bar.

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(18,19,15,0.1)',
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
  dueChip: { minHeight: 48, borderColor: 'transparent', backgroundColor: theme.colors.dueTint },
  dueDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.slice.due },
  dueText: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.dueInk },

  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 18,
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  stat: { flexGrow: 1, flexBasis: 100, minWidth: 0, paddingHorizontal: 8, gap: 3 },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.borderSoft },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
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
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  workingLabelTotal: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  workingValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  workingValueDue: { color: theme.colors.dueInk },
});
