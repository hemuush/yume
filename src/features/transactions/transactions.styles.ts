import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

// Shared by the Transactions screen and its modals/rows (MonthPickerModal,
// FilterModal, TransactionRow, TransactionDetailModal, AddTransactionModal).
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  emptyText: {
    fontFamily: theme.font.body,
    marginHorizontal: 20,
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: 10,
  },
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
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Search is its own mode (see the screen's own comment) — this row
  // replaces the scope pills/week nav while it's active, in the same slot.
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.font.body,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  searchCancel: { fontSize: 13, fontFamily: theme.font.roundedMedium, color: theme.colors.textSecondary },
  searchLoading: { paddingVertical: 40, alignItems: 'center' },

  weekNavBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  weekNavArrow: { fontSize: 18, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  weekNavArrowDisabled: { color: theme.colors.textMuted, opacity: 0.35 },

  // One confident figure + a plain-text comparison line — replaces the old
  // day-strip/spotlight-card approach entirely. See SpendBarChart.tsx.
  headlineAmt: { fontFamily: theme.font.monoBold, fontSize: 34, color: theme.colors.textPrimary },
  headlineSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  headlineSubUp: { fontFamily: theme.font.bodyBold, color: theme.colors.expense },
  headlineSubDown: { fontFamily: theme.font.bodyBold, color: theme.colors.income },

  // The Activity redesign's summary card: spent (big), money in and net
  // beside it, then the chart, its legend and a line saying what the tapped
  // bar cost — one block instead of a figure floating over a separate chart.
  sumCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  sumTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sumMain: { flex: 1, minWidth: 0 },
  sumKicker: {
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  sumSide: { alignItems: 'flex-end', gap: 4, paddingTop: 16 },
  sumSideLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  sumSideValue: { fontFamily: theme.font.monoBold, fontSize: 13.5, color: theme.colors.textPrimary },
  sumChart: { marginTop: 14 },
  sumHint: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 10 },

  // One row: ‹ period title › and the Week/Month switch.
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 20 },
  periodNav: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  periodNavOff: { opacity: 0.25 },
  periodTitleBtn: { flexShrink: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  periodTitle: { fontFamily: theme.font.roundedBold, fontSize: 19, color: theme.colors.textPrimary },
  periodSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  scopeSwitch: {
    marginLeft: 'auto',
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  scopeBtn: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: theme.radius.pill },
  scopeBtnOn: { backgroundColor: theme.colors.ink },
  scopeText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  scopeTextOn: { fontFamily: theme.font.bodyBold, color: theme.colors.surface },

  // Type chips and any picked-category chips, above the list.
  chipsRow: { gap: 6, paddingHorizontal: 20, paddingTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  chipOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  chipCat: { backgroundColor: theme.colors.primaryTint },
  chipText: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textSecondary },
  chipTextOn: { fontFamily: theme.font.bodyBold, color: theme.colors.surface },

  // A day's heading, above its card.
  dayHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 8,
  },
  dayTitle: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  dayDate: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  dayTotal: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },

  // One card per day — a later pass than the original flat, card-less list
  // (that design cited Apple Card's own borderless transaction rows). A
  // single unbroken list read fine at a handful of rows a day, but gave no
  // shape to scan by; boxing each day gives every day a bounded, evenly-
  // weighted unit, the way the day itself — not each transaction inside it —
  // is the thing worth a glance-and-move-on read. Rows inside stay the same
  // hairline-divided flatRow they always were, just inside the card's own
  // padding instead of sitting on the page background directly.
  // The "+N more" row that stands in for whatever's past the 4-row cap — a
  // day with ten transactions gets a fifth row instead of a fifth-through-
  // tenth, so every card starts at the same height and only the ones worth a
  // second look grow when tapped open.
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
  rowNoteInline: { fontSize: 13, color: theme.colors.textSecondary, fontFamily: theme.font.body },
  rowSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
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
  detailNote: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 6 },
  hintText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 14,
    marginBottom: 10,
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
