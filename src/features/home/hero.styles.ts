import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { GLASS } from '@/components/Glass';

export const styles = StyleSheet.create({
  card: { marginHorizontal: 20, padding: 16, gap: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32 },
  body: { gap: 12 },

  headLabel: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },
  headValue: {
    fontFamily: theme.font.bodyLight,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1.6,
    color: theme.colors.textPrimary,
  },
  headSymbol: {
    fontFamily: theme.font.body,
    fontSize: 28,
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
  chipOver: { borderColor: 'rgba(189,53,71,0.28)', backgroundColor: 'rgba(226,63,85,0.06)' },
  chipTextOver: { color: theme.colors.expenseText },
  dueChip: { borderColor: 'transparent', backgroundColor: theme.colors.dueTint },
  dueDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.slice.due },
  dueText: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.dueInk },

  pace: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  paceText: { flex: 1, fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textMuted },

  working: {
    borderRadius: 16,
    backgroundColor: GLASS.fillStrong,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  workingRow: {
    flexDirection: 'row',
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
  workingLabel: { flex: 1, fontFamily: theme.font.body, fontSize: 14, color: theme.colors.textSecondary },
  workingLabelTotal: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  workingValue: { fontFamily: theme.font.monoBold, fontSize: 14, color: theme.colors.textPrimary },
  workingValueDue: { color: theme.colors.dueInk },
});
