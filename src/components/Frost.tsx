import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { GLASS } from '@/components/Glass';
import { GrowFill } from '@/components/GrowFill';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';

/**
 * Small pieces Plan and the screens it opens still share: a card's topic as an icon disc and a name, small chips
 * that carry good or bad news, and a pace bar with a tick for where an even pace would be today. A screen's first
 * card is a SummaryCard (components/SummaryCard.tsx), not built from these.
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
  const { accent } = useAccent();
  return (
    <View style={[frost.kickerRow, inTile && frost.kickerInTile]}>
      {/* Tinted with the theme: a white disc on a cream card is invisible. */}
      <View style={[frost.kickerBadge, { backgroundColor: shade(accent, 88), borderWidth: 0 }]}>
        {typeof icon === 'string' ? <Feather name={icon} size={14} color={theme.colors.ink} /> : icon}
      </View>
      <Text style={frost.kicker} numberOfLines={2}>
        {children}
      </Text>
    </View>
  );
}

type FrostTone = 'ok' | 'warn' | 'bad';

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
  accessibilityLabel,
  height = 10,
}: {
  pct: number;
  color: string;
  marker?: number;
  animKey: string;
  /** The track's thickness; 10 by default, 8 on the flat summary cards. */
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Read out for the bar, which is otherwise decorative (the marker has no words of its own). */
  accessibilityLabel?: string;
}) {
  return (
    <View
      style={[frost.paceWrap, style]}
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[frost.paceTrack, { height, borderRadius: height / 2 }]}>
        <GrowFill
          animKey={animKey}
          pct={Math.max(0, Math.min(100, pct))}
          style={[frost.paceFill, { backgroundColor: color, borderRadius: height / 2 }]}
        />
      </View>
      {marker != null && (
        <View style={[frost.paceMarker, { left: `${Math.max(0, Math.min(100, marker))}%` }]} />
      )}
    </View>
  );
}

const frost = StyleSheet.create({
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

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 28,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.inkHairline,
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
    // The heroes are solid cream cards now, so the track is the soft tray tone (a white track vanished on them).
    backgroundColor: theme.colors.trayTrack,
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
});
