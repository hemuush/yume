import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  // Same shape every other screen's load-error banner uses (Notifications,
  // Transactions, Loans, Recurring, ...) — kept visually consistent rather
  // than a one-off inline style.
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  intro: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginHorizontal: 20,
    marginTop: 4,
    lineHeight: 17,
  },

  streakPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: theme.colors.secondaryTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.secondary,
    borderRadius: theme.radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  streakPillText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.ink },

  bed: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
    paddingHorizontal: 12,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  pot: { width: 52, alignItems: 'center', gap: 8 },
  potToday: { backgroundColor: theme.colors.primaryTint, borderRadius: 16, paddingVertical: 6 },
  plantSlot: { height: 58, justifyContent: 'flex-end', alignItems: 'center' },
  soil: { width: 36, height: 11, backgroundColor: theme.colors.inkWash, borderRadius: 6 },
  dayLabel: {
    fontFamily: theme.font.body,
    fontSize: 9,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  dayLabelToday: { fontFamily: theme.font.bodyBold, color: theme.colors.ink },

  legend: { flexDirection: 'row', marginHorizontal: 20, marginTop: 14 },
  legendItem: { flex: 1, alignItems: 'center', gap: 4 },
  legendLabel: { fontFamily: theme.font.body, fontSize: 9, color: theme.colors.textMuted },

  note: {
    marginHorizontal: 20,
    marginTop: 18,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    padding: 13,
  },
  noteLabel: {
    fontFamily: theme.font.roundedMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 3,
  },
  noteText: { fontFamily: theme.font.body, fontSize: 12.5, color: theme.colors.textPrimary, lineHeight: 18 },

  goalsSummary: {
    marginHorizontal: 20,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalsSummaryText: { fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textMuted, flex: 1 },
});
