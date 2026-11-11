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
  fontFamily: theme.font.bodyMedium,
  fontSize: theme.typeSize.title,
  letterSpacing: -0.3,
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
  forecastFigure: { gap: 2, flex: 1, minWidth: 0 },
  forecastValue: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
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
    fontSize: 16,
    lineHeight: 22,
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
    borderWidth: StyleSheet.hairlineWidth,
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
  tileWrap: { flex: 1, minWidth: 0 },
  // Compact tiles: the icon and the figure share a row, so a tile is about 95 dp, with no empty space.
  tileFill: { flex: 1, padding: 10, gap: 6, overflow: 'hidden', borderWidth: 1 },
  // A debt tile's body keeps its padding; the amber due strip runs edge to edge under it.
  debtTile: { padding: 0, gap: 0, justifyContent: 'space-between' },
  debtBody: { padding: 10, gap: 6 },
  debtDue: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.colors.dueRow },
  debtDueText: { fontFamily: theme.font.bodyBold, fontSize: 11, lineHeight: 15, color: theme.colors.dueInk },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  tileIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tilePct: {
    flexShrink: 1,
    fontFamily: theme.font.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  tilePctSign: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  tileName: {
    fontFamily: theme.font.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.textPrimary,
  },
  tileTrack: { height: 4, borderRadius: 2, backgroundColor: theme.colors.inkHairline, overflow: 'hidden' },
  tileProgress: { height: '100%', borderRadius: 2 },
  tileAmt: {
    fontFamily: theme.font.body,
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    lineHeight: 15,
    color: theme.colors.textSecondary,
  },
  tileOver: { fontFamily: theme.font.bodyBold, color: theme.colors.expenseText },

  /* ---------- Debt path ---------- */

  /* ---------- Goals ---------- */
  title: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.font.body, fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary },

  /* ---------- Friends & streak ---------- */
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
});
