import { useCallback, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { usePrivacy } from '@/theme/PrivacyContext';
import { usePressScale } from '@/lib/usePressScale';
import { getCachedUserName } from '@/db/settings';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  title: string;
  /** Shows a back chevron before the title — for pushed screens, not tabs. */
  showBack?: boolean;
  /** Screen-specific action (e.g. an AddButton), placed left of the profile button. */
  right?: React.ReactNode;
  /**
   * Suppresses the profile avatar button — for the Profile screen itself,
   * which would otherwise show a button whose destination is the screen
   * already on-screen.
   */
  hideUser?: boolean;
}

/**
 * The one header every screen uses. The profile button sits in the same
 * place on every screen — a fixed anchor to "you" that the user can reach
 * without first working out which screen they're on — so it's rendered here
 * rather than left to each screen to remember. Settings used to live here
 * too, but it pointed at the same place from every screen including
 * Settings itself; it now only lives inside Profile.
 */
export function AppHeader({ title, showBack, right, hideUser }: Props) {
  const insets = useSafeAreaInsets();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.left}>
        {showBack && (
          <AnimatedPressable
            onPress={() => router.back()}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={12}
            style={[styles.backBtn, animatedStyle]}
          >
            <Feather name="chevron-left" size={20} color={theme.colors.ink} />
          </AnimatedPressable>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.actions}>
        {right}
        {!hideUser && <HeaderUserButton />}
      </View>
    </View>
  );
}

/**
 * One-tap "hide savings & investment amounts" toggle. Deliberately not part
 * of the base header on every screen (it crowded the header row and didn't
 * read as core navigation next to profile/settings) — Profile and Settings
 * opt into it explicitly via `right`. Shares state with the same toggle in
 * Settings' own row (both read/write the one global setting).
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
export function HeaderUserButton({ soft }: { soft?: boolean } = {}) {
  const { accent, onAccent } = useAccent();
  // getCachedUserName() is a plain module-level cache, not reactive state —
  // reading it once at mount (as this used to) meant editing your name on
  // the Profile screen left every already-mounted header (Home, Loans,
  // Transactions, Reports tabs) showing the old initial until something
  // else happened to re-render them. Re-read on every focus instead.
  const [name, setName] = useState(() => getCachedUserName());
  useFocusEffect(
    useCallback(() => {
      setName(getCachedUserName());
    }, [])
  );
  const initial = name?.trim().charAt(0).toUpperCase();
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  return (
    <AnimatedPressable
      onPress={() => router.push('/profile')}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Your profile"
      style={[styles.iconBtn, soft && styles.iconBtnSoft, { backgroundColor: accent }, animatedStyle]}
    >
      {initial ? (
        <Text style={[styles.initial, { color: onAccent }]}>{initial}</Text>
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
  soft,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  label: string;
  badge?: boolean;
  /** Hairline instead of the 3px ink border — for the softer Home header. */
  soft?: boolean;
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
        soft && styles.iconBtnSoft,
        { backgroundColor: theme.colors.surface },
        animatedStyle,
      ]}
    >
      <Feather name={icon} size={16} color={theme.colors.ink} />
      {badge && <View style={styles.badge} />}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: { fontFamily: theme.font.roundedBold, fontSize: 22, color: theme.colors.textPrimary, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Kept as an alias — the base button is already soft now.
  iconBtnSoft: { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderSoft },
  initial: { fontFamily: theme.font.bodyBold, fontSize: 14 },
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
