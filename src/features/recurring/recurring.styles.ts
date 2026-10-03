import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

// Shared by the Recurring screen, the rows and RuleModal.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  errorBanner: {
    marginHorizontal: 20,
    marginTop: theme.layout.screenTopGap,
    marginBottom: 12,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.expenseTint,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.expense,
  },
  errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  errorDetail: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  // Skeleton rows while the screen loads.
  card: { marginBottom: 10, padding: 14 },
  // The Running, Paused and Not set up yet cards: rows with a hairline between.
  list: { paddingVertical: 2, paddingHorizontal: 14 },
  footnote: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
    marginHorizontal: 24,
    marginTop: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  rowMuted: { opacity: 0.6 },
  rowTitle: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  rowSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  ruleMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  ruleSide: { alignItems: 'flex-end', gap: 6 },
  ruleAmount: { fontFamily: theme.font.monoBold, fontSize: 13.5, color: theme.colors.textPrimary },
  make: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.ink,
  },
  makeText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.surface },
  hint: {
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textMuted,
    marginTop: 6,
    lineHeight: 16,
  },
  income: { color: theme.colors.incomeText },
  expense: { color: theme.colors.expenseText },
  fieldLabel: {
    fontSize: 10.5,
    fontFamily: theme.font.roundedMedium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
    marginBottom: 6,
    marginTop: 4,
  },
  // The recurring sheet (Direction C): its tabs, a row's picker opened in
  // place, and the row of next dates.
  tabs: { marginBottom: 14 },
  gap: { height: 14 },
  rowPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  rowPanelGrid: { paddingHorizontal: 8, paddingBottom: 12 },
  upcomingLabel: { marginTop: 6 },
  upcoming: { flexDirection: 'row', gap: 8 },
  endDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: theme.font.body,
    color: theme.colors.expenseText,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
});
