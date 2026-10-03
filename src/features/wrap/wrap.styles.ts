import { StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { EYEBROW } from '@/constants/textStyles';
import { shade } from '@/lib/color';
import type { WrapBeat } from './wrapData';

/**
 * Each beat's ground ("colour stories"): a soft vertical gradient; opening and closing beats use the theme
 * pack's two colours, the rest Yume's warm pastels. Always light, so it reads as the app, not a video.
 */
export function beatGradient(kind: WrapBeat['kind'], primary: string, secondary: string): [string, string] {
  switch (kind) {
    case 'hook':
      return [shade(primary, 88), shade(secondary, 93)];
    case 'kept':
      return [shade(secondary, 88), shade(primary, 94)];
    case 'bars':
      return ['#FDE3EE', '#FFE9DC'];
    case 'days':
    case 'weekDays':
      return ['#FFE3D6', '#FBF0CE'];
    case 'mover':
      return ['#FFE1D9', '#FDE3EE'];
    case 'usual':
      return ['#ECE7FC', shade(secondary, 93)];
    case 'final':
      return [shade(primary, 90), '#FDE3EE'];
  }
}

export const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  blob: { position: 'absolute', borderRadius: 999 },
  segs: { flexDirection: 'row', gap: 4, marginHorizontal: 14 },
  seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: theme.colors.inkHairline, overflow: 'hidden' },
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
    backgroundColor: theme.colors.glass,
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
  beat: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28 },
  kicker: { ...EYEBROW, color: theme.colors.textSecondary, letterSpacing: 1.2 },
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
  barTrack: { height: 14, borderRadius: 7, backgroundColor: theme.colors.inkWash, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 7 },

  cal: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  calSlot: { width: `${100 / 7}%`, padding: 3 },
  calCell: {
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: theme.colors.inkWash,
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
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 18,
    marginTop: 16,
    shadowColor: theme.colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
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
  cardBrand: {
    fontFamily: theme.font.roundedBold,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 14,
  },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
