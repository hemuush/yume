import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

/** The even gap between Reports' blocks (headline, "In short", calendar). */
export const BLOCK_GAP = 22;

/** Tallest bar in TrendBars, in px — the bar chart's own height is derived from it. */
export const BAR_MAX_HEIGHT = 56;

// Shared by the Reports screen and its pieces (PeriodRow, TrendBars, DayTotal).
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.expense },
  errDetail: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  empty: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, marginVertical: 16 },

  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  periodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  periodArrow: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  periodLabel: { fontFamily: theme.font.roundedBold, fontSize: 13, color: theme.colors.textPrimary },
  gran: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    padding: 3,
  },
  granBtn: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: theme.radius.pill },
  granBtnOn: { backgroundColor: theme.colors.secondaryTint },
  granText: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  granTextOn: { color: theme.colors.textPrimary },

  // The Overview/Categories/Trends jump bar — pinned in `header`, outside
  // the ScrollView, so it's reachable and shows the current section no
  // matter how far down the page you've scrolled.
  jumpBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  jumpChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
  },
  jumpChipOn: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  jumpChipText: { fontFamily: theme.font.bodyBold, fontSize: 11.5, color: theme.colors.textSecondary },
  jumpChipTextOn: { color: theme.colors.surface },

  headlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  eyebrow: {
    fontFamily: theme.font.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  big: {
    flex: 1,
    fontFamily: theme.font.monoBold,
    fontSize: 30,
    letterSpacing: -1.5,
    color: theme.colors.textPrimary,
  },
  // Same red/green + arrow badge language This Month's KPI tiles and the
  // stat cards already use, instead of a small two-line corner label.
  vsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  vsBadgeText: { fontFamily: theme.font.bodyBold, fontSize: 10.5 },
  headlineSub: {
    fontFamily: theme.font.body,
    fontSize: 10.5,
    color: theme.colors.textMuted,
    marginTop: 3,
    marginBottom: BLOCK_GAP,
  },

  blockTitle: {
    fontFamily: theme.font.roundedBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  hmTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  legendText: { fontFamily: theme.font.body, fontSize: 9.5, color: theme.colors.textMuted },
  legendSwatch: { width: 11, height: 11, borderRadius: 3 },

  reads: { marginTop: 14, gap: 6 },
  readRow: { flexDirection: 'row', gap: 6 },
  readBullet: { fontFamily: theme.font.body, fontSize: 10, color: theme.colors.idCoralDeep, lineHeight: 16 },
  readText: {
    flex: 1,
    fontFamily: theme.font.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.borderSoft, marginVertical: 22 },

  // The recurring/discretionary dot is the one style still shared with the
  // moon-split card's legend below.
  rdDot: { width: 8, height: 8, borderRadius: 3 },
  rdNote: { fontFamily: theme.font.body, fontSize: 9.5, color: theme.colors.textMuted, marginTop: 6 },

  moonCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
    padding: 18,
    alignItems: 'center',
  },
  moonTitle: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  moonSub: {
    fontFamily: theme.font.body,
    fontSize: 10.5,
    color: theme.colors.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  moonFigs: { flexDirection: 'row', gap: 22, marginTop: 14 },
  moonFig: { alignItems: 'flex-start' },
  moonFigLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  moonFigLabel: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textSecondary },
  moonFigValue: { fontFamily: theme.font.monoBold, fontSize: 15, marginTop: 3 },
  moonCaption: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 14,
    maxWidth: 260,
  },

  catCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    borderRadius: theme.radius.xl2,
    paddingHorizontal: 14,
  },
  catRow: { paddingVertical: 10 },
  catTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  catName: { flex: 1, fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textPrimary },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catPct: {
    fontFamily: theme.font.mono,
    fontSize: 9,
    color: theme.colors.textMuted,
    width: 28,
    textAlign: 'right',
  },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 8 },
  catAmt: { fontFamily: theme.font.monoBold, fontSize: 10.5, color: theme.colors.textPrimary },
  catDelta: { fontFamily: theme.font.mono, fontSize: 8 },
  catTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.inkWash,
    overflow: 'hidden',
  },
  catMore: { paddingVertical: 12, alignItems: 'center' },
  catMoreText: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textMuted },

  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: BAR_MAX_HEIGHT + 18,
    marginTop: 4,
  },
  barBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.borderSoft,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barValue: {
    fontFamily: theme.font.mono,
    fontSize: 8,
    color: theme.colors.textMuted,
    marginBottom: 3,
  },
  bar: { width: '68%', borderRadius: 3, minHeight: 3 },
  sparkAxis: { flexDirection: 'row', marginTop: 4 },
  sparkAxisLabel: {
    flex: 1,
    fontFamily: theme.font.mono,
    fontSize: 8.5,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  sparkAxisLabelOn: { color: theme.colors.idCoralDeep, fontFamily: theme.font.monoBold },

  // day-detail / drill popup
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },
  dayRowFirst: { borderTopWidth: 0 },
  dayMid: { flex: 1, minWidth: 0 },
  dayName: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12.5,
    color: theme.colors.textPrimary,
  },
  daySub: {
    fontFamily: theme.font.body,
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  dayAmt: { fontFamily: theme.font.monoBold, fontSize: 12, color: theme.colors.textPrimary },
  daySpinner: { paddingVertical: 24 },
  dayEmpty: { alignItems: 'center', paddingVertical: 8, gap: 4 },
  dayTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTotalLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  dayTotalValue: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
});
