import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

/** The even gap between Reports' blocks (heatmap card, story cards, "Where it went", trends). */
export const BLOCK_GAP = 22;

// Shared by the Reports screen and its pieces (PeriodRow, HeatmapCard, StoryCards, CategoryMosaic, TrendChart, DayTotal).
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

  // The heatmap card at the top: headline + the day-by-day grid in one card.
  hmCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 14,
    gap: 10,
    marginBottom: BLOCK_GAP,
  },
  hmHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  hmHeadMain: { flex: 1, minWidth: 0 },
  hmFacts: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  hmFactStrong: { fontFamily: theme.font.monoBold, color: theme.colors.textPrimary },
  hmFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hmHint: { flex: 1, fontFamily: theme.font.body, fontSize: 11.5, color: theme.colors.textSecondary },

  // Story cards: the period "in short", swiped sideways.
  storyBlock: { marginBottom: BLOCK_GAP },
  storyHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  storyPos: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  story: {
    minHeight: 168,
    borderRadius: theme.radius.xl2,
    padding: 16,
    justifyContent: 'space-between',
    gap: 10,
  },
  storyKicker: {
    fontFamily: theme.font.monoBold,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: theme.colors.inkSoft,
  },
  storyBig: {
    fontFamily: theme.font.roundedBold,
    fontSize: 28,
    lineHeight: 32,
    color: theme.colors.textPrimary,
  },
  storyDetail: {
    fontFamily: theme.font.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  storyFoot: { fontFamily: theme.font.bodyBold, fontSize: 12.5, color: theme.colors.textSecondary },
  storyMoonRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  storyMoonText: { flex: 1, minWidth: 0 },
  storyDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  storyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.borderSoft },
  storyDotOn: { width: 16, backgroundColor: theme.colors.ink },

  // "Where it went" mosaic.
  mosaic: { position: 'relative', marginBottom: 12 },
  tile: {
    position: 'absolute',
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.colors.background,
    padding: 8,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  tileRest: { backgroundColor: theme.colors.surfaceAlt },
  tileName: { fontFamily: theme.font.bodyBold, fontSize: 12, lineHeight: 15, color: theme.colors.ink },
  tilePct: { fontFamily: theme.font.roundedBold, fontSize: 18, lineHeight: 20, color: theme.colors.ink },
  tilePctSmall: { fontFamily: theme.font.roundedBold, fontSize: 12, lineHeight: 14 },
  tileAmt: { fontFamily: theme.font.mono, fontSize: 10.5, color: theme.colors.ink },
  tileUp: { fontFamily: theme.font.monoBold, color: theme.colors.expense },
  tileDown: { fontFamily: theme.font.monoBold, color: theme.colors.income },

  // Trends: one line chart with a Spending / Net worth switch.
  trendCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    padding: 14,
    gap: 6,
  },
  trendHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  trendTitle: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  trendSwitch: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  trendSwitchBtn: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: theme.radius.pill },
  trendSwitchBtnOn: { backgroundColor: theme.colors.ink },
  trendSwitchText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  trendSwitchTextOn: { fontFamily: theme.font.bodyBold, color: theme.colors.surface },
  trendRead: {
    fontFamily: theme.font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: theme.colors.textSecondary,
  },

  blockTitle: {
    fontFamily: theme.font.roundedBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontFamily: theme.font.body, fontSize: 9.5, color: theme.colors.textMuted },
  legendSwatch: { width: 11, height: 11, borderRadius: 3 },

  rule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.borderSoft, marginVertical: 22 },

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
