import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  // Same load-error banner shape as Notifications, Transactions, Loans and Recurring, kept consistent.
  errorBanner: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 4,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  intro: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    lineHeight: 17,
  },

  streakSummary: {
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakValue: { flex: 1, fontFamily: theme.font.roundedBold, fontSize: 22, color: theme.colors.ink },
  goalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  editGoal: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
  },
  editGoalText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },
  introHint: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  summaryGoal: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textSecondary },

  bed: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  pot: { flexGrow: 1, flexBasis: 52, minWidth: 52, alignItems: 'center', gap: 6 },
  potToday: {
    borderRadius: 18,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  plantSlot: { height: 64, justifyContent: 'flex-end', alignItems: 'center' },
  soil: { width: 36, height: 11, backgroundColor: theme.colors.inkWash, borderRadius: 6 },
  dayLabel: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  dayLabelToday: { fontFamily: theme.font.bodyBold, color: theme.colors.ink },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  legendItem: { flexGrow: 1, flexBasis: 64, alignItems: 'center', gap: 4 },
  legendLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },

  note: { marginHorizontal: 20, marginTop: 12, padding: 14 },
  noteLabel: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 3,
  },
  noteText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textPrimary, lineHeight: 18 },

  goalError: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.expenseText,
    marginBottom: 10,
  },
});
