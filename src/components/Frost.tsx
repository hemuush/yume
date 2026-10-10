import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { GLASS } from '@/components/Glass';
import { GrowFill } from '@/components/GrowFill';
import { theme } from '@/constants/theme';
import { SCREEN } from '@/components/screenStyles';

/**
 * The pieces every Frost screen shares (Plan and the screens it opens): a card's topic as an icon disc and a
 * name, small chips that carry good or bad news, the hero's big thin figure, and a pace bar with a tick for
 * where an even pace would be today.
 */

type FeatherName = React.ComponentProps<typeof Feather>['name'];

/** A card's topic: its icon on a small frosted disc, then the name. */
export function Kicker({
  icon,
  inTile,
  children,
}: {
  icon: FeatherName | React.ReactElement;
  /** In a tile: leaves room for the ↗ in its corner. */
  inTile?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[frost.kickerRow, inTile && frost.kickerInTile]}>
      <View style={frost.kickerBadge}>
        {typeof icon === 'string' ? <Feather name={icon} size={14} color={theme.colors.ink} /> : icon}
      </View>
      <Text style={frost.kicker} numberOfLines={2}>
        {children}
      </Text>
    </View>
  );
}

export type FrostTone = 'ok' | 'warn' | 'bad';

/** A small outlined chip: neutral, or green / amber / red when it carries news. */
export function FrostChip({
  icon,
  tone,
  children,
}: {
  icon?: FeatherName;
  tone?: FrostTone;
  children: React.ReactNode;
}) {
  const color =
    tone === 'ok'
      ? theme.colors.incomeText
      : tone === 'bad'
        ? theme.colors.expenseText
        : tone === 'warn'
          ? theme.colors.warnInk
          : theme.colors.textSecondary;
  return (
    <View
      style={[
        frost.chip,
        tone === 'ok' && frost.chipOk,
        tone === 'warn' && frost.chipWarn,
        tone === 'bad' && frost.chipBad,
      ]}
    >
      {icon && <Feather name={icon} size={13} color={color} />}
      <Text style={[frost.chipText, tone && { color }]} numberOfLines={2}>
        {children}
      </Text>
    </View>
  );
}

/**
 * A 10px frosted track filled to `pct` in `color`, with an ink tick at `marker` (where an even pace would be
 * today) when given.
 */
export function PaceBar({
  pct,
  color,
  marker,
  animKey,
  style,
}: {
  pct: number;
  color: string;
  marker?: number;
  animKey: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[frost.paceWrap, style]}>
      <View style={frost.paceTrack}>
        <GrowFill
          animKey={animKey}
          pct={Math.max(0, Math.min(100, pct))}
          style={[frost.paceFill, { backgroundColor: color }]}
        />
      </View>
      {marker != null && (
        <View style={[frost.paceMarker, { left: `${Math.max(0, Math.min(100, marker))}%` }]} />
      )}
    </View>
  );
}

export const frost = StyleSheet.create({
  /** A screen's first card (its hero), under the header. */
  hero: { marginHorizontal: SCREEN.gutter, marginTop: theme.layout.screenTopGap, padding: 16, gap: 10 },
  /** A glass card holding a list of rows. */
  list: { marginHorizontal: SCREEN.gutter, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  heroMain: { flex: 1, minWidth: 0, gap: 8 },

  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kickerInTile: { paddingRight: 20 },
  kickerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS.fillStrong,
    borderWidth: 1,
    borderColor: GLASS.edge,
  },
  kicker: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 13, color: theme.colors.textSecondary },

  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  bigValue: {
    fontFamily: theme.font.bodyLight,
    fontSize: theme.typeSize.hero,
    lineHeight: 42,
    letterSpacing: -1.2,
    color: theme.colors.textPrimary,
  },
  bigSymbol: { fontFamily: theme.font.body, fontSize: 22, letterSpacing: 0, color: theme.colors.textMuted },
  bigNote: { fontFamily: theme.font.bodyMedium, fontSize: 14, color: theme.colors.textMuted },
  side: { alignItems: 'flex-end', maxWidth: '45%' },
  sideLabel: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textMuted },
  sideValue: { fontFamily: theme.font.body, fontSize: 17, color: theme.colors.textPrimary, marginTop: 1 },
  sub: { fontFamily: theme.font.body, fontSize: 13.5, lineHeight: 19, color: theme.colors.textSecondary },
  subBold: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  /** A small line under a bar. */
  note2: { fontFamily: theme.font.bodyMedium, fontSize: 11.5, color: theme.colors.textMuted },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 28,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(18,19,15,0.1)',
    maxWidth: '100%',
  },
  chipText: {
    flexShrink: 1,
    fontFamily: theme.font.bodyMedium,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  chipOk: { borderColor: 'rgba(28,154,91,0.32)', backgroundColor: 'rgba(28,154,91,0.08)' },
  chipWarn: { borderColor: 'rgba(224,162,58,0.45)', backgroundColor: 'rgba(224,162,58,0.1)' },
  chipBad: { borderColor: 'rgba(189,53,71,0.28)', backgroundColor: 'rgba(226,63,85,0.06)' },

  paceWrap: { justifyContent: 'center', marginTop: 2 },
  paceTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: GLASS.edge,
    overflow: 'hidden',
  },
  paceFill: { height: '100%', borderRadius: 5 },
  paceMarker: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: theme.colors.ink,
  },

  /** Section title over a glass list, on the wallpaper. */
  note: {
    fontFamily: theme.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textMuted,
    marginHorizontal: SCREEN.gutter + 4,
    marginTop: 8,
  },
});
