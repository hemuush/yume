import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SECTION_TITLE, SECTION_GAP } from '@/constants/textStyles';
import { SCREEN } from '@/components/screenStyles';
import { GLASS } from '@/components/Glass';

/** Every Reports card: the app's one flat card (cream, rounded, a hairline edge), without the screen margin. */
const CARD = {
  backgroundColor: theme.colors.surface,
  borderRadius: theme.radius.xl2,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: theme.colors.borderSoft,
} as const;

/** The even gap between Reports' blocks (heatmap card, day card, story cards, "Where it went"). */
const BLOCK_GAP = SCREEN.sectionGap;

// Shared by the Reports screen and its pieces (PeriodRow, HeatmapCard, DayCard, ReportInsights, CategoryBar, CategoryList, TrendChart, DayTotal).
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  dimmed: { opacity: 0.55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errTitle: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.expenseText },
  errDetail: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  errRetry: { marginTop: 16, alignSelf: 'stretch' },
  empty: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, marginVertical: 16 },

  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodPill: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fillStrong,
    borderRadius: theme.radius.pill,
  },
  periodArrow: {
    width: 44,
    height: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  periodArrowOff: { opacity: 0.35 },
  // Shrinks and wraps rather than clipping a long custom range ("20 Dec 2025 – 4 Jan 2026").
  periodLabel: {
    flexShrink: 1,
    textAlign: 'center',
    fontFamily: theme.font.roundedBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  granChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: GLASS.edge,
    backgroundColor: GLASS.fillStrong,
    borderRadius: theme.radius.pill,
  },
  granChipText: { fontFamily: theme.font.roundedMedium, fontSize: 14, color: theme.colors.ink },
  // The Days tab's heatmap card.

  // Shared section headings.
  storyHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  storyPos: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted },

  // The day open under the heatmap.
  dayCard: {
    ...CARD,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: BLOCK_GAP,
  },
  dayCardEmbedded: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginBottom: 0,
    marginHorizontal: -16,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dayHeadText: { flex: 1, minWidth: 0 },
  dayTitle: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  dayClose: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  dayFoot: {
    marginTop: 4,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
  },

  // Weekday rhythm: seven bars, a dashed "usual day" line, and a read line.

  // Biggest spends: the period's largest single expenses, in the day card's row.
  bigBlock: { marginBottom: BLOCK_GAP },
  bigCard: {
    ...CARD,
    paddingTop: 4,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  bigFoot: {
    marginTop: 4,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  bigFootStrong: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },

  // Categories: how the list is grouped (by category or by account).
  catSplitCaption: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textMuted,
    paddingTop: 0,
  },

  // Trends: one line chart with a Spending / Net worth switch.
  trendCard: {
    ...CARD,
    padding: 16,
    gap: 8,
  },
  trendHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  trendTitle: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  trendReadTray: {
    borderRadius: 14,
    backgroundColor: theme.colors.tray,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trendRead: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },

  trendBlock: { marginTop: BLOCK_GAP, gap: 12 },

  // Money in and out: paired bars per month with what was kept under each, then a three-cell summary.
  flowLegend: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flowLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flowLegendDot: { width: 10, height: 10, borderRadius: 3 },
  flowLegendText: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  flowChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingTop: 6 },
  flowCol: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 6, borderRadius: 12 },
  flowBars: { height: 100, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  flowBar: { width: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  flowBarEdge: {
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.colors.textMuted,
  },
  flowBarLive: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.ink },
  flowLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  flowLabelOn: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  stripCard: {
    flexDirection: 'row',
    ...CARD,
  },
  stripCardStack: { flexDirection: 'column' },
  stripCell: { flex: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 14, gap: 3 },
  stripCellStacked: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderSoft },
  stripCellDivided: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.borderSoft },
  stripLabel: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textSecondary },
  stripValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  stripSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },

  // Against your usual: each category's month beside its own earlier months.
  tracksBlock: { marginTop: BLOCK_GAP },
  tracksCard: {
    ...CARD,
    overflow: 'hidden',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 68,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  trackMid: { flex: 1, minWidth: 0 },
  trackName: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  trackSub: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  trackEnd: { alignItems: 'flex-end', gap: 4 },
  trackPct: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textMuted },
  trackPctOver: { color: theme.colors.expenseText },
  trackPctUnder: { color: theme.colors.incomeText },
  trackFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  trackFootText: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textMuted },
  trackFootLink: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.link },

  trendLink: { alignSelf: 'flex-start', paddingVertical: 8 },
  trendLinkText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.link },

  tidyNudge: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.colors.dueTint,
  },
  tidyNudgeText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  tidyNudgeLink: { fontFamily: theme.font.bodyBold, textDecorationLine: 'underline' },
  blockTitle: { ...SECTION_TITLE, marginBottom: SECTION_GAP.bottom },

  catCard: {
    ...CARD,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  catBar: {
    flexDirection: 'row',
    height: 9,
    gap: 3,
    marginTop: 4,
    marginBottom: 14,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // A faint inner edge keeps the palest category colours (yellow, butter, mint) readable on the white card.
  catBarSeg: {
    flexBasis: 0,
    minWidth: 3,
    borderRadius: 4,
    boxShadow: `inset 0px 0px 0px 1px ${theme.colors.inkHairline}`,
  },
  // The card over "Where it went": its title and group menu, the total and the split as one bar.
  sumCard: { ...CARD, padding: 16, marginBottom: 12 },
  sumHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sumTitle: { ...SECTION_TITLE, flexShrink: 1 },
  breakdownContext: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  breakdownHeading: {
    fontFamily: theme.font.roundedBold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 6,
  },
  breakdownSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
  },
  breakdownAmount: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyLight,
    fontSize: theme.typeSize.headline,
    letterSpacing: -1.1,
    color: theme.colors.textPrimary,
  },
  catMain: { flex: 1, minWidth: 0 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSoft,
  },
  catSplitLoading: { paddingVertical: 8 },
  catSplitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 8 },
  catSplitName: { flex: 1, fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  catSplitAmt: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  catLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 2, paddingTop: 4 },
  catLink: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  catMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  catLinkText: { fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.link },
  catName: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catPct: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    width: 38,
    textAlign: 'right',
  },
  catRight: { alignItems: 'flex-end', gap: 8, maxWidth: '40%', flexShrink: 1 },
  catAmt: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  catDelta: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 12 },
  catTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.inkHairline,
    overflow: 'hidden',
  },
  catMore: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  catMoreText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },

  // day rows
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  dayMid: { flex: 1, minWidth: 0 },
  dayName: {
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  daySub: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  dayAmt: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  daySpinner: { paddingVertical: 24 },
  dayEmpty: { alignItems: 'center', paddingVertical: 8, gap: 4 },
  dayTotalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayTotalLabel: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  dayTotalValue: {
    fontVariant: ['tabular-nums'],
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
});
