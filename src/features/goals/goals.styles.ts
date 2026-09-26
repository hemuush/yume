import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

// Shared by the Savings Goals screen and its GoalCard / AddGoalModal /
// ContributeModal / GoalDetailModal.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 12,
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

  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  cardArchived: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 11 },
  cardName: { fontSize: 14.5, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  cardTarget: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.borderSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  contributeBtn: {
    marginTop: 11,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: theme.colors.primaryTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
  },
  contributeBtnText: { fontSize: 12, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },

  errorText: { fontFamily: theme.font.body, color: theme.colors.expense, fontSize: 13, marginBottom: 12 },
  modalHint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 14,
    lineHeight: 17,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontFamily: theme.font.roundedMedium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateFieldsRow: { flexDirection: 'row', gap: 10 },
  dateFieldInput: { textAlign: 'center' },
  noteInput: { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 },
  letterNote: {
    fontFamily: theme.font.body,
    fontStyle: 'italic',
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },

  dangerLabel: {
    fontSize: 10.5,
    fontFamily: theme.font.bodyBold,
    letterSpacing: 0.6,
    color: theme.colors.textMuted,
    marginTop: 8,
    marginBottom: 10,
  },
  deleteButton: { backgroundColor: theme.colors.expenseTint },

  contributeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  contributeInput: { flex: 1 },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
});
