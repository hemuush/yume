import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SECTION_TITLE, SECTION_GAP } from '@/constants/textStyles';
import { listScreenStyles } from '@/features/shared/listScreenStyles';

// Shared by the Budgets screen, BudgetRow, and AddBudgetModal.
export const styles = StyleSheet.create({
  ...listScreenStyles,

  lapsedCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.goldTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  lapsedHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lapsedHeadText: { flex: 1, minWidth: 0 },
  lapsedTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  lapsedNames: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  lapsedChevron: { width: 24, height: 32, alignItems: 'center', justifyContent: 'center' },
  lapsedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 },
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
  continueBtnText: { fontSize: 13, fontFamily: theme.font.roundedBold, color: theme.colors.surface },

  listCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: theme.radius.xl2,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  // Budgets' own list sits under a "This month" heading; Profile's use of the card has none.
  listTitle: {
    ...SECTION_TITLE,
    marginHorizontal: 20,
    marginTop: SECTION_GAP.top,
    marginBottom: SECTION_GAP.bottom,
  },
  listCardTitled: { marginTop: 0 },
  // Self-padded like RecentTransactionRow: BudgetRow renders in this listCard on Profile's "You" tab but
  // also in Home's unpadded card, so it can't rely on a container for its horizontal inset.
  row: { paddingVertical: 14, paddingHorizontal: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 8 },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  rowNameBlock: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  rowParent: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  rowAmount: {
    fontFamily: theme.font.mono,
    fontSize: 12.5,
    textAlign: 'right',
    color: theme.colors.textPrimary,
  },
  rowAmountOver: { color: theme.colors.expenseText, fontFamily: theme.font.monoBold },
  rowAmountOf: { color: theme.colors.textMuted, fontFamily: theme.font.mono },
  rowFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 6,
  },
  rowNote: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  rowPace: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.incomeText },
  rowPaceAhead: { color: theme.colors.warnInk },
  rowNoteOver: { color: theme.colors.expenseText, fontFamily: theme.font.bodyBold },

  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  pickerGap: { marginBottom: 16 },
});
