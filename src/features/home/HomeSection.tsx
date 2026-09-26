import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { HOME } from './homeStyles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A titled block on the Home screen — a rounded-face heading with an optional
 * "See all →" on the right. Replaces the little pill SectionLabel used
 * elsewhere; the softer register wants a plain heading, not a tag.
 *
 * `badge` adds a small count after the title (Needs you); `heading`
 * replaces the title text with something else in the same slot — the
 * Plans card puts its Upcoming · Budgets · Goals tabs there, so its tabs
 * line up exactly where every other section's title sits.
 */
export function HomeSection({
  title,
  badge,
  heading,
  onSeeAll,
  children,
}: {
  title: string;
  badge?: number;
  heading?: React.ReactNode;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {heading ?? (
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {badge != null && badge > 0 && (
              <View style={styles.badge} accessibilityLabel={`${badge} item${badge === 1 ? '' : 's'}`}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            )}
          </View>
        )}
        {onSeeAll && (
          <AnimatedPressable
            onPress={onSeeAll}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`See all — ${title}`}
            style={[styles.seeAll, animatedStyle]}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <Feather name="arrow-right" size={13} color={theme.colors.textSecondary} />
          </AnimatedPressable>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: HOME.sectionGap },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: HOME.gutter,
    marginBottom: 10,
    minHeight: 24,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: theme.font.roundedBold, fontSize: 17, color: theme.colors.textPrimary },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.expense,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.font.monoBold, fontSize: 11, color: theme.colors.white },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
});
