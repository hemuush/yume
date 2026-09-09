import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsRowIcon } from '@/components/SettingsRowIcon';
import { FlynnIllustration } from '@/components/FlynnIllustration';
import { theme } from '@/constants/theme';
import { usePressScale } from '@/lib/usePressScale';

const AnimatedRow = Animated.createAnimatedComponent(Pressable);

interface Action {
  label: string;
  sub: string;
  icon: string;
  bg: string;
  onPress: () => void;
}

/**
 * The destination behind the tab bar's center "+". A short list of actions
 * rather than a form of its own — each one hands off to the exact same
 * modal the relevant tab already uses (via a route param), so there's only
 * ever one place that knows how to create a transaction.
 */
export default function QuickAddScreen() {
  const insets = useSafeAreaInsets();

  const actions: Action[] = [
    {
      label: 'Add Expense',
      sub: 'Money going out',
      icon: 'arrow-up-bold-circle-outline',
      bg: theme.colors.flatPink,
      onPress: () => router.replace('/(tabs)/transactions?openAdd=expense'),
    },
    {
      label: 'Add Income',
      sub: 'Money coming in',
      icon: 'arrow-down-bold-circle-outline',
      bg: theme.colors.flatMint,
      onPress: () => router.replace('/(tabs)/transactions?openAdd=income'),
    },
    {
      label: 'Add Transfer',
      sub: 'Between your own accounts',
      icon: 'swap-horizontal-bold',
      bg: theme.colors.flatBlue,
      onPress: () => router.replace('/(tabs)/transactions?openAdd=transfer'),
    },
    {
      label: 'Loans & Friends',
      sub: 'Pay an EMI, or settle up',
      icon: 'account-group-outline',
      bg: theme.colors.flatLime,
      onPress: () => router.replace('/(tabs)/loans'),
    },
    {
      label: 'Add Past Data',
      sub: 'Catch up on an old month in bulk',
      icon: 'calendar-clock-outline',
      bg: theme.colors.accentTint,
      onPress: () => router.replace('/add-historical'),
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <Pressable style={styles.backdrop} onPress={() => router.back()} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <FlynnIllustration size={44} pose="peek" />
          <Text style={styles.title}>What are we adding?</Text>
        </View>
        {actions.map((a) => (
          <ActionRow key={a.label} action={a} />
        ))}
        <Pressable style={styles.cancel} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ActionRow({ action }: { action: Action }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <AnimatedRow
      style={[styles.row, animatedStyle]}
      onPress={action.onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <SettingsRowIcon name={action.icon} backgroundColor={action.bg} size={18} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.rowLabel}>{action.label}</Text>
        <Text style={styles.rowSub}>{action.sub}</Text>
      </View>
    </AnimatedRow>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    padding: 20,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.textMuted,
    opacity: 0.4,
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  title: { fontFamily: theme.font.display, fontSize: 19, color: theme.colors.textPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.thick,
    borderColor: theme.colors.ink,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  rowLabel: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.textPrimary },
  rowSub: { fontFamily: theme.font.body, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  cancelText: { fontFamily: theme.font.bodyBold, fontSize: 14, color: theme.colors.textMuted },
});
