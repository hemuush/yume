import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { themedStyles } from '@/theme/themedStyles';

// Shared by the Transactions screen and its modals/rows (FilterModal, TransactionRow,
// TransactionDetailModal).
/** A 44dp target, 2dp padding per side and the control's border. */
export const styles = themedStyles(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.home.background },
    errorBanner: {
      marginHorizontal: 16,
      marginBottom: 12,
      padding: 14,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.expenseTint,
      borderWidth: theme.border.thin,
      borderColor: theme.colors.expense,
    },
    errorText: {
      fontFamily: theme.font.body,
      fontSize: 13,
      color: theme.colors.expenseText,
      marginBottom: 8,
    },
    errorTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
    errorDetail: {
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 3,
      lineHeight: 16,
    },

    // Search is its own mode (see the screen's own comment) — this row
    // replaces the period pill and the Week / Month switch in the header while it is active.
    searchBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2, marginBottom: 4 },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      fontFamily: theme.font.body,
      color: theme.colors.textPrimary,
      padding: 0,
    },
    searchCancel: { fontSize: 13, fontFamily: theme.font.bodyBold, color: theme.colors.link },
    searchCancelBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
    searchLoading: { paddingVertical: 40, alignItems: 'center' },
    // Above the results: how many matched (or that this is only the newest of more).
    searchCount: {
      paddingHorizontal: 16,
      paddingBottom: 2,
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    // Search before anything is typed: what it looks at, things to try, and past searches.
    searchEmpty: { alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 24 },
    searchEmptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    searchEmptyTitle: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
    searchEmptySub: {
      fontFamily: theme.font.body,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      color: theme.colors.textMuted,
      maxWidth: 280,
    },
    searchSuggest: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
    searchSuggestChip: {
      minHeight: 48,
      paddingHorizontal: 12,
      borderRadius: 16,
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    searchSuggestText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
    recentWrap: { alignSelf: 'stretch', marginTop: 8, gap: 6 },
    recentHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    recentLabel: { ...EYEBROW, color: theme.colors.textMuted },
    recentClear: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.link },
    recentCard: {
      borderRadius: 22,
      paddingHorizontal: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
    recentDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
    recentText: { flex: 1, fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textPrimary },

    // The Spent card shares Home's compact financial typography.
    // The selected chart amount can extend past its first/last column.
    // Compact: Spent, Money in and Left side by side as label-over-value figures, none of them a hero.
    sumCard: {
      marginHorizontal: 2,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 14,
      overflow: 'visible',
    },
    // The same content inside Insights: the sheet is the surface, so no card of its own.
    sumBare: { paddingBottom: 6 },
    sumKicker: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
    headlineAmt: {
      fontFamily: theme.font.bodyMedium,
      fontSize: 20,
      lineHeight: 24,
      letterSpacing: -0.2,
      fontVariant: ['tabular-nums'],
      color: theme.colors.textPrimary,
    },
    // The change against the period before, one line under the figure (green when spending is down).
    // The comparison, right-aligned: the figure in colour, what it is against in a quiet line under it.
    sumChangeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 1 },
    sumChangeText: {
      flexShrink: 1,
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    sumChangeValue: { fontFamily: theme.font.bodyBold, fontSize: 12, fontVariant: ['tabular-nums'] },
    sumChart: { marginTop: 10 },
    sumLead: { flexShrink: 1, minWidth: 0 },
    // Money in and Left: one quiet line under the categories.
    sumCashflow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 2, marginTop: 10 },
    sumMetric: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
    sumMetricAmount: {
      fontFamily: theme.font.bodyMedium,
      fontVariant: ['tabular-nums'],
      fontSize: 12,
      color: theme.colors.textPrimary,
    },
    // Week | Month as a pill of two buttons, the picked one filled with the theme's ink: the same look as the type chips
    // below it. 3 dp around 36 dp buttons and the 1 dp edge make it the pill's 44.
    scopeSwitch: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 3,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.home.control,
      borderWidth: 1,
      borderColor: theme.colors.home.edge,
    },
    scopeSwitchStacked: { alignSelf: 'stretch' },
    scopeBtn: {
      minHeight: 36,
      paddingHorizontal: 16,
      borderRadius: theme.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scopeBtnStacked: { flex: 1 },
    // One weight picked or not: the fill and the light text show the pick, so switching never changes the width of
    // either word.
    scopeText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textPrimary },
    scopeTextOn: { color: theme.colors.textPrimary },

    // ‹ This week 9–15 Nov ▾ › in one pill, Week | Month at its right end.
    periodBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    periodBarStacked: { flexDirection: 'column', alignItems: 'stretch' },
    periodPill: {
      flexShrink: 1,
      minHeight: 44,
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.home.surface,
      borderWidth: 1,
      borderColor: theme.colors.home.edge,
    },
    periodPillStacked: { alignSelf: 'stretch' },
    periodInner: { flexShrink: 1, flexDirection: 'row', alignItems: 'center' },
    // Stacked above the switch, the pill is the full width: the arrows go to its ends and the name between them.
    periodInnerStacked: { flexGrow: 1, flexShrink: 0 },
    periodNav: { width: 36, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
    periodNavOff: { opacity: theme.opacity.limit },
    // The period: its name (with "Week 1 of 5" under it when that is useful) and a chevron that says it opens the picker.
    periodTitleBtn: {
      flexShrink: 1,
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 2,
    },
    periodTitleBtnStacked: { flexGrow: 1, justifyContent: 'center' },
    periodTitleCol: { flexShrink: 1, minWidth: 0 },
    periodTitle: {
      fontFamily: theme.font.bodyBold,
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textPrimary,
    },
    periodSub: {
      fontFamily: theme.font.body,
      fontSize: 11,
      lineHeight: 14,
      color: theme.colors.textSecondary,
    },

    listArea: { flex: 1 },
    // Shown while a line is being moved, above the tab bar like the undo bar.
    dragHint: {
      position: 'absolute',
      left: 20,
      right: 20,
      minHeight: 46,
      borderRadius: 23,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dragHintText: { flex: 1, fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.onInk },
    // The period, as a small chip in the shrunk header; it opens the month picker.
    periodChip: {
      minHeight: 44,
      paddingVertical: 6,
      maxWidth: 130,
      paddingHorizontal: 12,
      borderRadius: theme.radius.pill,
      justifyContent: 'center',
      backgroundColor: theme.colors.home.control,
      borderWidth: 1,
      borderColor: theme.colors.home.edge,
    },
    periodChipText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textPrimary },

    // The one row of filters: it scrolls sideways, or wraps at large text.
    typeFilterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginHorizontal: 16, gap: 6 },
    pillGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    typeScrollContent: { minHeight: 44, alignItems: 'center' },
    pillWrap: { flex: 1, flexWrap: 'wrap' },
    // The category shortcuts after the type pills: a little more air than between pills, so the two groups read apart.
    quickGroup: { marginLeft: 10 },
    // 44 tall whatever it holds: the 40 dp pills and chips are drawn inside it with a touch area that reaches the edges, and
    // a row that grew when a chip arrived moved the pills and the whole list under them.
    appliedFilters: { marginTop: 6, marginHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    typeBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 10,
      // A pill, like the Week | Month switch above and the picked-filter chips beside it.
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.home.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
    },
    // The same weight picked or not, so picking a type never changes the width of the pills beside it.
    typeText: {
      textAlign: 'center',
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    typeTextOn: { color: theme.colors.textPrimary },
    filterSelected: { backgroundColor: theme.colors.home.selected, borderColor: theme.colors.home.selected },
    filterPressed: { backgroundColor: theme.colors.home.pressed },
    filterGap: { height: 4 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      // Drawn 40 tall like the type pills; the touch area stays 48 (hitSlop).
      minHeight: 40,
      maxWidth: '100%',
      paddingHorizontal: 12,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    // flexShrink: a long label or category name wraps inside the chip instead of pushing it past the screen.
    chipText: {
      flexShrink: 1,
      fontFamily: theme.font.bodyBold,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },

    income: { color: theme.colors.incomeText },
    expense: { color: theme.colors.expenseText },
    rowRefund: { fontFamily: theme.font.bodyBold, color: theme.colors.incomeText },
    // A transaction's actions, as three compact buttons under its card (the hint text is the accessibility hint).
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    quickBtn: {
      flexGrow: 1,
      flexBasis: 96,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 10,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.home.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.home.edge,
    },
    quickBtnWide: { flexBasis: '100%' },
    quickIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.home.control,
    },
    quickText: {
      flexShrink: 1,
      fontFamily: theme.font.bodyMedium,
      fontSize: 12,
      color: theme.colors.textPrimary,
    },
    // Edit, then the bin, which turns into a red "Delete?" on the first tap.
    entryBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    detailFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    detailEdit: { flexGrow: 1, flexBasis: 140 },
    deleteBtn: {
      minWidth: 48,
      minHeight: 48,
      paddingVertical: 0,
      borderRadius: 24,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderSoft,
    },
    deleteBtnAsk: { backgroundColor: theme.colors.expenseText, borderColor: theme.colors.expenseText },
    deleteAskText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.onInk },
    // A split part's detail: the whole payment, this part in bold.
    splitCard: {
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: theme.colors.home.surface,
      borderColor: theme.colors.home.edge,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: theme.radius.lg,
    },
    splitCardTitle: { ...EYEBROW },
    splitPart: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    splitPartName: {
      flexGrow: 1,
      flexBasis: 140,
      fontFamily: theme.font.body,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    splitPartAmount: {
      fontVariant: ['tabular-nums'],
      fontFamily: theme.font.body,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    splitPartMine: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
    hintText: {
      fontFamily: theme.font.body,
      fontSize: 12,
      color: theme.colors.textMuted,
      marginBottom: 10,
      lineHeight: 17,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: theme.font.bodyMedium,
      color: theme.colors.home.secondaryText,
      marginBottom: 6,
      marginTop: 10,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    // The filter sheet's Clear sits small beside its wide Show button.
    filterClear: { flexGrow: 1, flexBasis: 140, paddingHorizontal: 18 },
    filterFoot: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterApply: { flexGrow: 1, flexBasis: 140 },
    searchClear: { minHeight: 48, justifyContent: 'center' },
    subGroup: {
      marginTop: -6,
      marginBottom: 14,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.borderSoft,
    },
    subGroupLabel: {
      fontSize: 12,
      fontFamily: theme.font.bodyBold,
      color: theme.colors.textMuted,
      marginBottom: 8,
    },
  })
);
