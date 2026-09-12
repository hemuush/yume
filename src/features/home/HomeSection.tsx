import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A titled block on the Home screen — a rounded-face heading with an optional
 * "See all →" on the right. Replaces the little pill SectionLabel used
 * elsewhere; the softer register wants a plain heading, not a tag.
 */
export function HomeSection({
  title,
  onSeeAll,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
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
  wrap: { marginTop: 22 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  title: { fontFamily: theme.font.roundedBold, fontSize: 16, color: theme.colors.textPrimary },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontFamily: theme.font.bodyMedium, fontSize: 12, color: theme.colors.textSecondary },
});
