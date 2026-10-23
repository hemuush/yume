import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';
import { GLASS } from '@/components/Glass';

// Plan as "the road ahead": glass cards on Home's wallpaper. Shared by the runway, jars, debt path, goals,
// the people and streak tiles, and Coming up.
const GAP = 10;
/** The one inset inside every Plan card: card text, day headings and row content start on the same line. */
const INSET = 14;

const figure = {
  fontFamily: theme.font.body,
  fontSize: theme.typeSize.title,
  letterSpacing: -0.5,
  color: theme.colors.textPrimary,
  fontVariant: ['tabular-nums'] as 'tabular-nums'[],
} as const;

export const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN.gutter,
    paddingVertical: SCREEN.cardPad,
    paddingHorizontal: INSET,
    gap: 8,
  },
  cardFirst: { marginTop: 0 },
  row: { flexDirection: 'row', gap: GAP, marginHorizontal: SCREEN.gutter },
  rowStack: { flexDirection: 'column' },

  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  bigNote: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.textMuted },

  /* ---------- Runway ---------- */
  forecastHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  forecastFigure: { gap: 2 },
  forecastValue: {
    fontFamily: theme.font.bodyLight,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  forecastFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  forecastMetric: {
    flexGrow: 1,
    flexBasis: 110,
    minWidth: 0,
    paddingVertical: 6,
    gap: 2,
  },
  forecastMetricValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  forecastStatusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondaryTint,
  },
  forecastStatusWarning: { backgroundColor: theme.colors.surface },
  forecastStatusTitle: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textPrimary,
  },
  forecastFact: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  forecastAttention: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSoft,
    paddingTop: 8,
  },
  forecastWarning: {
    backgroundColor: theme.colors.expenseTint,
    borderTopWidth: 0,
    borderRadius: 18,
    padding: 12,
  },
  forecastAttentionCopy: { flex: 1, minWidth: 0, gap: 3 },
  /* ---------- Budgets and goals: tiles, three to a row ---------- */
  grid: { gap: 8, marginHorizontal: SCREEN.gutter },
  gridRow: { flexDirection: 'row', gap: 8 },
  gridTile: { flex: 1, minWidth: 0, padding: 10, gap: 2, overflow: 'hidden' },
  tileAdd: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
  },
  tileSlim: { minHeight: 48, flexDirection: 'row', padding: 6 },
  addDisc: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS.fillStrong,
  },
  addDiscSmall: { width: 32, height: 32, borderRadius: 16 },
  addText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  whatIfIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.dueTint,
  },
  tileWrap: { flex: 1, minWidth: 0 },
  tileFill: { flex: 1, padding: 10, gap: 6, overflow: 'hidden', minHeight: 166, borderWidth: 1 },
  tileIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tilePct: {
    fontFamily: theme.font.bodyLight,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -1,
    color: theme.colors.textPrimary,
  },
  tilePctSign: { fontFamily: theme.font.body, fontSize: 12, letterSpacing: 0, color: theme.colors.textMuted },
  tileName: {
    minHeight: 32,
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textPrimary,
  },
  tileTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.inkHairline,
    marginTop: 'auto',
    overflow: 'hidden',
  },
  tileProgress: { height: '100%', borderRadius: 3 },
  tileAmt: {
    fontFamily: theme.font.body,
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    color: theme.colors.textSecondary,
  },
  tileOver: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },

  /* ---------- Debt path ---------- */
  pathValue: { ...figure, flexShrink: 1 },
  pathNote: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    letterSpacing: 0,
    color: theme.colors.textMuted,
  },

  /* ---------- Goals ---------- */
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary },

  whatIfCard: { paddingVertical: 8 },
  whatIfHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  whatIfHeadCopy: { flex: 1, minWidth: 0 },
  whatIfBold: { fontSize: 13, fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  gainNote: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },

  /* ---------- Friends & streak ---------- */
  compactSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  balanceLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 4,
  },
  compactValue: { fontFamily: theme.font.bodyMedium, fontSize: 18, lineHeight: 24 },
  tile: { flex: 1, minWidth: 0, padding: 14, gap: 6 },
  go: { position: 'absolute', top: 14, right: 14 },
  value: { ...figure },
  income: { color: theme.colors.incomeText },
  over: { color: theme.colors.expenseText },
  tileSub: { fontFamily: theme.font.body, fontSize: 12, lineHeight: 17, color: theme.colors.textMuted },
  people: { flexDirection: 'row', gap: 6, marginTop: 'auto', overflow: 'hidden' },
  person: { maxWidth: 50, alignItems: 'center', gap: 3 },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.ink },
  sproutDay: { alignItems: 'center', gap: 3 },
  dayLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  sprouts: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, minHeight: 32 },

  /* ---------- Coming up ---------- */
  list: { marginHorizontal: SCREEN.gutter, overflow: 'hidden', paddingBottom: 4 },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: INSET,
    paddingTop: 10,
  },
  dayHeadText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textMuted },
  dueIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  dueMid: { flex: 1, minWidth: 0 },
  dueTitle: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textPrimary },
  dueSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14 },
});
