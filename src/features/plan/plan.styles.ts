import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';
import { GLASS } from '@/components/Glass';

// Plan as "the road ahead": glass cards on Home's wallpaper. Shared by the runway, jars, debt path, goals,
// the people and streak tiles, and Coming up.
const GAP = 10;
/** The one inset inside every Plan card: card text, day headings and row content start on the same line. */
const INSET = 14;
/** The runway's drawing height, without the date row under it. */
export const RUNWAY_HEIGHT = 72;

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
  forecastFigure: { gap: 4 },
  forecastValue: {
    fontFamily: theme.font.bodyLight,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    color: theme.colors.textPrimary,
  },
  runway: { height: RUNWAY_HEIGHT, marginTop: 4 },
  runwayAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  runwayAxisText: { fontFamily: theme.font.bodyMedium, fontSize: 11, color: theme.colors.textMuted },
  runwayLow: {
    position: 'absolute',
    fontFamily: theme.font.bodyBold,
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  pin: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pinDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 3, backgroundColor: theme.colors.surface },

  /* ---------- Budgets and goals: tiles, three to a row ---------- */
  grid: { gap: 8, marginHorizontal: SCREEN.gutter },
  gridRow: { flexDirection: 'row', gap: 8 },
  gridTile: { flex: 1, minWidth: 0, padding: 10, gap: 2, overflow: 'hidden' },
  tileAdd: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(18,19,15,0.22)',
    borderRadius: 24,
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
  tileFill: { padding: 10, gap: 2, overflow: 'hidden', minHeight: 132 },
  tileIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tilePct: {
    fontFamily: theme.font.bodyLight,
    fontSize: 28,
    lineHeight: 32,
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
    backgroundColor: theme.colors.inkWash,
    marginTop: 4,
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
  personName: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted },
  sproutDay: { alignItems: 'center', gap: 3 },
  dayLabel: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textMuted },
  personAmt: { fontFamily: theme.font.bodyBold, fontSize: 12, color: theme.colors.textSecondary },
  sprouts: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, minHeight: 32, marginTop: 'auto' },

  /* ---------- Coming up ---------- */
  list: { marginHorizontal: SCREEN.gutter, overflow: 'hidden', paddingBottom: 4 },
  dayHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: INSET,
    paddingTop: 10,
  },
  statRow: { flexDirection: 'row', gap: GAP, marginHorizontal: SCREEN.gutter, marginTop: GAP },
  statWrap: { flex: 1, minWidth: 0 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondaryTint,
  },
  statCopy: { flex: 1, minWidth: 0 },
  statValue: { fontFamily: theme.font.bodyBold, fontSize: 18, color: theme.colors.textPrimary },
  statLine: { fontFamily: theme.font.body, fontSize: 11, lineHeight: 15, color: theme.colors.textMuted },
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
