import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, G } from 'react-native-svg';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { HeaderHills } from '@/features/home/HeaderHills';
import { RING_COLORS } from '@/features/home/MonthRing';
import type { ThemePack } from '@/theme/themes';

/**
 * A theme pack drawn as a little piece of Home, in the pack's own colours:
 * the header's gradient and hills, the month ring with Suu's dot on its
 * face, and — at the larger size — the avatar and an Add button. Used by
 * Settings' current-theme card and every card on the Theme page, so you
 * see what a pack looks like instead of two colour halves.
 */
export function ThemePreview({
  pack,
  height,
  detailed = false,
}: {
  pack: ThemePack;
  height: number;
  detailed?: boolean;
}) {
  const top = shade(pack.primary, 88, 4);
  const bottom = shade(pack.primary, 96, 2);
  const ring = detailed ? 54 : 32;
  return (
    <View style={[styles.wrap, { height }]} importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={[top, bottom]} style={styles.fill} />
      {detailed && (
        <>
          <View style={styles.greeting}>
            <Text style={styles.hello}>Good evening</Text>
            <Text style={styles.date}>Your month at a glance</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: pack.primary }]} />
          <View style={[styles.addPill, { backgroundColor: pack.primary }]}>
            <Text style={styles.addText}>+ Add</Text>
          </View>
        </>
      )}
      <View style={[styles.ring, { width: ring, height: ring, bottom: detailed ? 18 : 12 }]}>
        <MiniRing
          size={ring}
          primary={pack.primary}
          secondary={pack.secondary}
          dot={pack.dot ?? pack.secondary}
        />
      </View>
      <View style={styles.hills}>
        <HeaderHills sky={bottom} primary={pack.primary} secondary={pack.secondary} />
      </View>
    </View>
  );
}

/** A still month ring — spent, saved, free — with Suu's dot on the cream face. */
function MiniRing({
  size,
  primary,
  secondary,
  dot,
}: {
  size: number;
  primary: string;
  secondary: string;
  dot: string;
}) {
  const stroke = size > 40 ? 6 : 4;
  const c = size / 2;
  const r = c - stroke / 2 - 1;
  const len = 2 * Math.PI * r;
  const slices = [
    { color: RING_COLORS.spent, share: 0.46, from: 0 },
    { color: secondary, share: 0.2, from: 0.5 },
    { color: primary, share: 0.26, from: 0.72 },
  ];
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={theme.colors.surfaceAlt} strokeWidth={stroke} fill="none" />
      <Circle cx={c} cy={c} r={r - stroke / 2 - 3} fill="#FBF3DA" />
      <G rotation={-90} origin={`${c}, ${c}`}>
        {slices.map((s) => (
          <Circle
            key={s.from}
            cx={c}
            cy={c}
            r={r}
            stroke={s.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[s.share * len, len]}
            strokeDashoffset={-s.from * len}
          />
        ))}
      </G>
      <Circle cx={c} cy={c - size * 0.08} r={size * 0.08} fill={dot} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  greeting: { position: 'absolute', left: 14, top: 12 },
  hello: { fontFamily: theme.font.roundedBold, fontSize: 15, color: theme.colors.textPrimary },
  date: { fontFamily: theme.font.body, fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
  avatar: {
    position: 'absolute',
    right: 14,
    top: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  addPill: {
    position: 'absolute',
    left: 14,
    bottom: 26,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  addText: { fontFamily: theme.font.roundedBold, fontSize: 12, color: theme.colors.textPrimary },
  ring: { position: 'absolute', right: 12 },
  hills: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
