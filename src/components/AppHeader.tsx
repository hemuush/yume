import { useCallback, useState } from 'react';
// The header's buttons, shared by SkyHeader and HomeHeader (the old AppHeader component they replaced is gone).
import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { usePressScale } from '@/lib/usePressScale';
import { getCachedUserName } from '@/db/settings';
import { useReturnOrPush } from '@/lib/useReturnOrPush';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * One-tap "hide savings & investment amounts" toggle, sharing state with Settings' row. Not in the base
 * header (it crowded the row); Profile and Settings opt in via `right`.
 */
export function HeaderPrivacyToggle() {
  const { hideAmounts, toggleHideAmounts } = usePrivacy();
  return (
    <HeaderIconButton
      icon={hideAmounts ? 'eye-off' : 'eye'}
      onPress={toggleHideAmounts}
      label={hideAmounts ? 'Show savings & investment amounts' : 'Hide savings & investment amounts'}
    />
  );
}

/** The profile button — an avatar bubble showing the user's initial, accent-filled. */
export function HeaderUserButton({
  size,
}: {
  /** A larger round button (Home's header); the default is 34. */
  size?: number;
} = {}) {
  const { accent, onAccent } = useAccent();
  // getCachedUserName() is a non-reactive module cache, so re-read it on every focus: a name edited in
  // Profile must update the initial in every already-mounted header (Home, Loans, Transactions, Reports).
  const [name, setName] = useState(() => getCachedUserName());
  useFocusEffect(
    useCallback(() => {
      setName(getCachedUserName());
    }, [])
  );
  const initial = name?.trim().charAt(0).toUpperCase();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  // Profile opens Loans, People, Categories and Backup, whose headers have this button too: return to an
  // already-open Profile instead of stacking Profile -> Loans -> Profile endlessly.
  const returnOrPush = useReturnOrPush();
  return (
    <AnimatedPressable
      onPress={() => returnOrPush({ name: 'profile' }, '/profile')}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Your profile"
      style={[
        styles.iconBtn,
        size != null && { width: size, height: size, borderRadius: size / 2 },
        { backgroundColor: accent },
        animatedStyle,
      ]}
    >
      {initial ? (
        <Text style={[styles.initial, size != null && size > 36 && styles.initialLarge, { color: onAccent }]}>
          {initial}
        </Text>
      ) : (
        <Feather name="user" size={16} color={onAccent} />
      )}
    </AnimatedPressable>
  );
}

export function HeaderIconButton({
  icon,
  onPress,
  label,
  badge,
  count,
  size,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  label: string;
  badge?: boolean;
  /** A small number in the corner instead of the dot — e.g. how many filters are on. Hidden at 0. */
  count?: number;
  /** A larger round button (Home's header); the default is 34. */
  size?: number;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.iconBtn,
        size != null && { width: size, height: size, borderRadius: size / 2 },
        { backgroundColor: theme.colors.surface },
        animatedStyle,
      ]}
    >
      <Feather name={icon} size={size != null && size > 36 ? 18 : 16} color={theme.colors.ink} />
      {count != null && count > 0 ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : (
        badge && <View style={styles.badge} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: theme.font.bodyBold, fontSize: 14 },
  initialLarge: { fontFamily: theme.font.bodyBold, fontSize: 15 },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: theme.font.monoBold, fontSize: 10, color: theme.colors.surface },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.expense,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
});
