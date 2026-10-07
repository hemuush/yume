import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { HeaderUserButton } from '@/components/AppHeader';
import { theme } from '@/constants/theme';
import { shade } from '@/lib/color';
import { useAccent } from '@/theme/AccentContext';
import { HeaderHills } from './HeaderHills';
import { Spark } from './Spark';

// Three sparks, fewer than Home's four: these bands are shorter. `top` is below the status-bar inset.
const SPARKS = [
  { top: 6, left: 52, size: 5, opacity: 0.9 },
  { top: 30, left: 72, size: 3, opacity: 0.75 },
  { top: 14, left: 38, size: 3, opacity: 0.7 },
];

/**
 * A tab's header in Home's family: the same sky band, sparks and hills, a 25px title with an optional line
 * under it, and the profile button. Anything passed as children (Reports' period control) sits in the band;
 * `actions` (Activity's search and filter) sit beside the profile button.
 */
export function SkyHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
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
          <View style={styles.titleBlock}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            {actions}
            <HeaderUserButton soft size={40} />
          </View>
        </View>
        {children}
      </View>
      <HeaderHills sky={gradientBottom} primary={accent} secondary={secondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: 20, paddingBottom: 10, gap: 12, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleBlock: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 25, color: theme.colors.ink },
  subtitle: {
    fontFamily: theme.font.bodyMedium,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
