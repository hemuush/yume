import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

// Shared by the Transactions screen and its modals/rows (MonthPickerModal,
// FilterModal, TransactionRow, TransactionDetailModal, AddTransactionModal).
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  // Shown only before the first successful load — the same "gate on the
  // primary data being null" pattern Reports already uses, so a cold nav
  // never flashes "Nothing logged" before the real data has even arrived.
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { marginHorizontal: 20, color: theme.colors.textMuted, fontSize: 13, marginBottom: 10 },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expense },
  errorDetail: { fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: theme.colors.idGold },
  filterBtnText: { fontSize: 12, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  scopeRow: { paddingHorizontal: 20 },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  weekNavBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  weekNavArrow: { fontSize: 18, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  weekNavArrowDisabled: { color: theme.colors.textMuted, opacity: 0.35 },
  weekNavLabel: { fontSize: 12, fontFamily: theme.font.bodyBold, color: theme.colors.textMuted },

  // One confident figure + a plain-text comparison line — replaces the old
  // day-strip/spotlight-card approach entirely. See SpendBarChart.tsx.
  headline: { paddingHorizontal: 22, marginTop: 14 },
  headlineAmt: { fontFamily: theme.font.monoBold, fontSize: 34, color: theme.colors.textPrimary },
  headlineSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  headlineSubUp: { fontFamily: theme.font.bodyBold, color: theme.colors.expense },
  headlineSubDown: { fontFamily: theme.font.bodyBold, color: theme.colors.income },
  rule: { height: 1, backgroundColor: theme.colors.borderSoft, marginHorizontal: 22, marginTop: 20 },

  // One card per day — a later pass than the original flat, card-less list
  // (that design cited Apple Card's own borderless transaction rows). A
  // single unbroken list read fine at a handful of rows a day, but gave no
  // shape to scan by; boxing each day gives every day a bounded, evenly-
  // weighted unit, the way the day itself — not each transaction inside it —
  // is the thing worth a glance-and-move-on read. Rows inside stay the same
  // hairline-divided flatRow they always were, just inside the card's own
  // padding instead of sitting on the page background directly.
  dayCard: {
    marginHorizontal: 22,
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  dayCardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayLabel: { fontFamily: theme.font.roundedMedium, fontSize: 13, color: theme.colors.textSecondary },
  dayLabelDate: { fontFamily: theme.font.mono, fontSize: 10, color: theme.colors.textMuted },
  dayCardTotal: { fontFamily: theme.font.monoBold, fontSize: 13 },
  flatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  flatRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  // The "+N more" row that stands in for whatever's past the 4-row cap — a
  // day with ten transactions gets a fifth row instead of a fifth-through-
  // tenth, so every card starts at the same height and only the ones worth a
  // second look grow when tapped open.
  dayMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  dayMoreDots: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayMoreText: { flex: 1, fontSize: 13, fontFamily: theme.font.bodyBold, color: theme.colors.textSecondary },
  dayMoreAmt: { fontFamily: theme.font.mono, fontSize: 12, color: theme.colors.textMuted },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  yearLabel: {
    fontSize: 17,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textPrimary,
    minWidth: 60,
    textAlign: 'center',
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCell: {
    width: '30%',
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
  },
  monthCellDisabled: { opacity: 0.35 },
  monthCellText: { fontSize: 14, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  monthCellTextDisabled: { color: theme.colors.textMuted },
  rowLabel: { fontSize: 15, color: theme.colors.textPrimary, fontFamily: theme.font.bodyMedium },
  rowNoteInline: { fontSize: 13, color: theme.colors.textSecondary, fontFamily: theme.font.bodyMedium },
  rowSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  rowValue: { fontSize: 14, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  income: { color: theme.colors.income },
  expense: { color: theme.colors.expense },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  detailTitle: { fontSize: 16, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  detailAmount: {
    fontSize: 24,
    fontFamily: theme.font.monoBold,
    color: theme.colors.textPrimary,
    marginTop: 14,
  },
  detailNote: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 6 },
  hintText: { fontSize: 12, color: theme.colors.textMuted, marginTop: 14, marginBottom: 10, lineHeight: 17 },
  fieldLabel: {
    fontSize: 10.5,
    fontFamily: theme.font.roundedMedium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  subGroup: {
    marginTop: -6,
    marginBottom: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  subGroupLabel: {
    fontSize: 11.5,
    fontFamily: theme.font.bodyBold,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
});
