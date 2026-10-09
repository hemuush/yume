import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import type { WrapBeat } from './wrapData';

/** The dot before each beat's kicker: what the beat is about, in the slice colours' deep shades. */
export function kickerTone(kind: WrapBeat['kind']): string {
  switch (kind) {
    case 'kept':
      return theme.colors.secondaryDeep;
    case 'bars':
    case 'mover':
      return theme.colors.idCoralDeep;
    case 'days':
    case 'weekDays':
      return theme.colors.idGoldDeep;
    default:
      return theme.colors.link;
  }
}

export const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  segs: { flexDirection: 'row', gap: 4, marginHorizontal: 14 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(16,32,51,0.12)', overflow: 'hidden' },
  segFill: { height: '100%', backgroundColor: theme.colors.ink },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginHorizontal: 14,
  },
  topLabel: { fontFamily: theme.font.roundedMedium, fontSize: 13, color: theme.colors.textSecondary },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapArea: { flex: 1 },
  paused: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 28,
    backgroundColor: theme.colors.ink,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pausedText: { fontFamily: theme.font.bodyBold, fontSize: 11, color: theme.colors.surface },

  // A beat fills the space under the bar: kicker at the top, the story centred below it.
  beat: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { ...EYEBROW, flexShrink: 1, color: theme.colors.textSecondary, letterSpacing: 1.2 },
  // The glass card that holds a beat's chart.
  chartCard: { marginHorizontal: -4 },
  chartBody: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  middle: { flex: 1, justifyContent: 'center' },
  title: {
    fontFamily: theme.font.roundedBold,
    fontSize: 40,
    lineHeight: 46,
    color: theme.colors.textPrimary,
  },
  display: {
    fontFamily: theme.font.roundedBold,
    fontSize: 28,
    lineHeight: 34,
    color: theme.colors.textPrimary,
  },
  displaySmall: {
    fontFamily: theme.font.roundedBold,
    fontSize: 22,
    lineHeight: 28,
    color: theme.colors.textPrimary,
  },
  huge: { fontFamily: theme.font.monoBold, fontSize: 48, lineHeight: 56, color: theme.colors.textPrimary },
  body: { fontFamily: theme.font.body, fontSize: 15, lineHeight: 21, color: theme.colors.textSecondary },
  bodyStrong: { fontFamily: theme.font.monoBold, color: theme.colors.textPrimary },
  center: { textAlign: 'center' },
  gapS: { marginTop: 6 },
  gapM: { marginTop: 14 },
  lettersRow: { flexDirection: 'row', flexWrap: 'wrap' },

  ringWrap: { alignItems: 'center', marginBottom: 18 },

  bars: { gap: 14 },
  barHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 6,
  },
  barName: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textPrimary },
  barAmount: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  barTrack: { height: 14, borderRadius: 7, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 7 },

  cal: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  calSlot: { width: `${100 / 7}%`, padding: 3 },
  calCell: {
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  calFill: { ...StyleSheet.absoluteFill, backgroundColor: theme.colors.idGoldDeep },
  calRing: { ...StyleSheet.absoluteFill, borderRadius: 8, borderWidth: 2.5, borderColor: theme.colors.ink },
  calDay: { fontFamily: theme.font.mono, fontSize: 10, color: theme.colors.textPrimary },

  moverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },

  week: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 170 },
  weekCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' },
  weekBar: { width: '100%', borderRadius: 8 },
  weekDay: { fontFamily: theme.font.mono, fontSize: 11, color: theme.colors.textSecondary },

  // The closing card: the period in short, made to be shared as an image.
  finalMiddle: { flex: 1, justifyContent: 'center' },
  card: { marginTop: 16, padding: 12, borderRadius: 30, overflow: 'hidden' },
  cardBody: { padding: 18, paddingTop: 22 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardKicker: { ...EYEBROW, color: theme.colors.textMuted },
  cardTotal: {
    fontFamily: theme.font.monoBold,
    fontSize: 32,
    lineHeight: 40,
    color: theme.colors.textPrimary,
    marginTop: 6,
  },
  cardLine: { fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textSecondary },
  cardRows: { gap: 7, marginTop: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDot: { width: 9, height: 9, borderRadius: 5 },
  cardName: { flex: 1, fontFamily: theme.font.body, fontSize: 13, color: theme.colors.textPrimary },
  cardAmount: { fontFamily: theme.font.monoBold, fontSize: 13, color: theme.colors.textPrimary },
  cardBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardBrandText: { fontFamily: theme.font.roundedBold, fontSize: 12, color: theme.colors.textPrimary },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
