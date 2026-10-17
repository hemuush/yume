import { useCallback, useState } from 'react';
import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { HEADER } from './headerMetrics';
import { GLASS } from '@/components/Glass';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { usePressScale } from '@/lib/usePressScale';
import { getCachedUserName, getUserName } from '@/db/settings';
import { onSettingsRestored } from '@/lib/dataEvents';
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
  /** A larger round button (Home's header); the default is 44. */
  size?: number;
} = {}) {
  const { accent, onAccent } = useAccent();
  // Paint the cached initial immediately, then load it for a cold start and after restored settings.
  const [name, setName] = useState(() => getCachedUserName());
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let request = 0;
      const refresh = () => {
        const id = ++request;
        setName(getCachedUserName());
        void getUserName().then(
          (savedName) => {
            if (active && id === request) setName(savedName);
          },
          () => {
            // Keep the cached initial or safe user icon if the name read fails.
          }
        );
      };
      refresh();
      const unsubscribe = onSettingsRestored(refresh);
      return () => {
        active = false;
        unsubscribe();
      };
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
  glass = false,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  label: string;
  badge?: boolean;
  /** A small number in the corner instead of the dot — e.g. how many filters are on. Hidden at 0. */
  count?: number;
  /** A larger round button (Home's header); the default is 44. */
  size?: number;
  /** A frosted disc, for headers on a wallpaper (Home, Activity). */
  glass?: boolean;
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
        styles.bare,
        size != null && { width: size, height: size, borderRadius: size / 2 },
        glass && styles.glass,
        animatedStyle,
      ]}
    >
      <Feather name={icon} size={20} color={theme.colors.ink} />
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
    width: HEADER.actionSize,
    height: HEADER.actionSize,
    borderRadius: HEADER.actionSize / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A header action: just the icon on the header, no disc and no border (the quiet bar).
  bare: {
    width: HEADER.actionSize,
    height: HEADER.actionSize,
    borderRadius: HEADER.actionSize / 2,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  glass: { borderWidth: 1, borderColor: GLASS.edge, backgroundColor: GLASS.fillStrong },
  initial: { fontFamily: theme.font.bodyBold, fontSize: 13 },
  initialLarge: { fontFamily: theme.font.bodyBold, fontSize: 14 },
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
  countText: { fontFamily: theme.font.monoBold, fontSize: 11, color: theme.colors.surface },
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
