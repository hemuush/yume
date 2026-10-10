import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';
import { SCREEN } from './screenStyles';
import { SECTION_TITLE, SECTION_GAP } from '@/constants/textStyles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Titled Home block with optional "See all →"; `badge` adds a count after the title (Needs you). `heading`
 * replaces the title text (Plans tabs sit there); `right` replaces "See all" (Profile's "+ Account").
 */
export function Section({
  title,
  badge,
  heading,
  onSeeAll,
  right,
  first,
  children,
}: {
  title: string;
  badge?: number;
  heading?: React.ReactNode;
  onSeeAll?: () => void;
  right?: React.ReactNode;
  /** The first section under a screen's header: it sits the usual 8 below it, not a full section gap. */
  first?: boolean;
  children: React.ReactNode;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <View style={[styles.wrap, first && styles.wrapFirst]}>
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
        {right}
        {onSeeAll && (
          <AnimatedPressable
            onPress={onSeeAll}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`See all — ${title}`}
            style={[styles.seeAll, animatedStyle]}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <Feather name="arrow-right" size={14} color={theme.colors.link} />
          </AnimatedPressable>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: SECTION_GAP.top },
  wrapFirst: { marginTop: theme.layout.screenTopGap },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SCREEN.gutter,
    marginBottom: SECTION_GAP.bottom,
    minHeight: 24,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: SECTION_TITLE,
  badge: {
    minWidth: 20,
    minHeight: 20,
    paddingHorizontal: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.expense,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: theme.font.monoBold, fontSize: 11, color: theme.colors.white },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  seeAllText: { fontFamily: theme.font.bodyMedium, fontSize: 13, color: theme.colors.link },
});
