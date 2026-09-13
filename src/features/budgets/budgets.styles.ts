import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

// Shared by the Budgets screen, BudgetRow, and AddBudgetModal.
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
  errorDetail: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 16 },

  summaryCard: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 16,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  summaryLabel: { fontSize: 11, color: theme.colors.textSecondary, marginBottom: 6 },
  summaryAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  summaryAmount: { fontFamily: theme.font.monoBold, fontSize: 18, color: theme.colors.textPrimary },
  summaryOf: { fontSize: 12, color: theme.colors.textMuted },
  summaryTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.borderSoft,
    marginTop: 10,
    overflow: 'hidden',
  },
  summaryFill: { height: '100%', borderRadius: 3 },

  lapsedCard: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.goldTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  lapsedTitle: {
    fontFamily: theme.font.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  lapsedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  lapsedName: { flex: 1, fontSize: 13, fontFamily: theme.font.bodyMedium, color: theme.colors.textPrimary },
  lapsedAmount: {
    fontFamily: theme.font.mono,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  continueBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.ink,
  },
  continueBtnText: { fontSize: 11.5, fontFamily: theme.font.bodyBold, color: theme.colors.surface },

  listCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  // Self-padded, like RecentTransactionRow's row — BudgetRow renders inside
  // this listCard on Profile's "You" tab, but also directly inside Home's
  // own (unpadded) card style, so it can't rely on a container for its
  // horizontal inset or it runs edge-to-edge wherever that container has
  // none.
  row: { paddingVertical: 14, paddingHorizontal: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 },
  rowName: { flex: 1, fontSize: 14.5, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  rowAmount: {
    fontFamily: theme.font.mono,
    fontSize: 12.5,
    textAlign: 'right',
    color: theme.colors.textPrimary,
  },
  rowAmountOver: { color: theme.colors.expense, fontFamily: theme.font.monoBold },
  rowAmountOf: { color: theme.colors.textMuted, fontFamily: theme.font.mono },
  rowNote: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },
  rowNoteOver: { color: theme.colors.expense, fontFamily: theme.font.bodyBold },

  track: { height: 5, borderRadius: 3, backgroundColor: theme.colors.borderSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },

  modalHint: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 14, lineHeight: 17 },
  fieldLabel: {
    fontSize: 10.5,
    fontFamily: theme.font.roundedMedium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  errorText: { color: theme.colors.expense, fontSize: 13, marginBottom: 12 },
});
