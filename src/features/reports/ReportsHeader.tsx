import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { HeaderUserButton } from '@/components/AppHeader';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { ReportWindow } from '@/lib/period';
import { useAccent } from '@/theme/AccentContext';
import { HeaderHills } from '@/features/home/HeaderHills';
import { Spark } from '@/features/home/Spark';
import { PeriodRow } from './PeriodRow';

// Three sparks, fewer than Home's four: this band is shorter. `top` is below the status-bar inset.
const SPARKS = [
  { top: 6, left: 52, size: 5, opacity: 0.9 },
  { top: 30, left: 72, size: 3, opacity: 0.75 },
  { top: 14, left: 38, size: 3, opacity: 0.7 },
];

/**
 * Reports' header: the same sky band, sparks and hills as Home, with the title and the period control in it,
 * so the two tabs read as one app. Pinned, like the summary under it.
 */
export function ReportsHeader({
  cursor,
  onChange,
}: {
  cursor: ReportWindow;
  onChange: (c: ReportWindow) => void;
}) {
  const { accent, secondary } = useAccent();
  const insets = useSafeAreaInsets();
  const top = insets.top + 10;
  const gradientTop = shade(accent, 90, 4);
  const gradientBottom = shade(accent, 96, 2);
  return (
    <View>
      <View style={[styles.band, { paddingTop: top }]}>
        <LinearGradient
          colors={[gradientTop, gradientBottom]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {SPARKS.map((s, i) => (
          <Spark key={i} top={top + s.top} left={s.left} size={s.size} opacity={s.opacity} delay={i * 700} />
        ))}
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            Reports
          </Text>
          <HeaderUserButton soft size={40} />
        </View>
        <PeriodRow cursor={cursor} onChange={onChange} />
      </View>
      <HeaderHills sky={gradientBottom} primary={accent} secondary={secondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: 20, paddingBottom: 10, gap: 12, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 25, color: theme.colors.ink },
});
