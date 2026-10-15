import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SECTION_TITLE, SECTION_GAP } from '@/constants/textStyles';
import { listScreenStyles } from '@/features/shared/listScreenStyles';

// Shared by the Budgets screen, BudgetRow, and AddBudgetModal.
export const styles = StyleSheet.create({
  ...listScreenStyles,

  lapsedCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 22,
    // A warm frost: the gold tint let through the glass, so it reads as a note on the wallpaper.
    backgroundColor: 'rgba(255,239,204,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  lapsedHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  lapsedHeadText: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  lapsedTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textPrimary },
  lapsedNames: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  lapsedChevron: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  lapsedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 10 },
  lapsedName: {
    flexGrow: 1,
    flexBasis: 100,
    minWidth: 0,
    fontSize: 13,
    fontFamily: theme.font.bodyMedium,
    color: theme.colors.textPrimary,
  },
  lapsedAmount: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginRight: 8,
  },
  continueBtn: {
    minHeight: 44,
    justifyContent: 'center',
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
  row: { paddingVertical: 12, paddingHorizontal: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  rowTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 },
  rowAmounts: { alignItems: 'flex-start', marginTop: 2 },
  moreBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: theme.colors.borderSoft,
    backgroundColor: 'transparent',
  },
  rowNameBlock: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  rowParent: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  rowAmount: {
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    maxWidth: '100%',
    fontFamily: theme.font.bodyMedium,
    fontSize: 12.5,
    textAlign: 'right',
    color: theme.colors.textSecondary,
  },
  rowAmountOver: { color: theme.colors.expenseText, fontFamily: theme.font.bodyBold },
  rowAmountOf: { color: theme.colors.textMuted, fontFamily: theme.font.bodyMedium },
  rowFoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 6,
  },
  rowNote: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
  rowPace: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.incomeText },
  rowPaceAhead: { color: theme.colors.warnInk },
  rowNoteOver: { color: theme.colors.expenseText, fontFamily: theme.font.bodyBold },

  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 14,
  },
  rolloverCopy: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  pickerGap: { marginBottom: 16 },
});
