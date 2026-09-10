import { useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { View, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { HomeIcon, ActivityIcon, LoanIcon, ReportsIcon } from '@/components/icons/TabIcons';
import { useReduceMotion } from '@/lib/useReduceMotion';

/**
 * A tab's icon inside the floating pill. The bar itself is the user's accent
 * colour (matching the Home header); the active tab gets a soft chip in the
 * contrast colour with the icon punched through in the accent hue, inactive
 * icons are the contrast colour at low opacity. The chip fades + scales in
 * over 160ms — calmer than the old spring bounce.
 */
function TabIcon({ Icon, focused }: { Icon: typeof HomeIcon; focused: boolean }) {
  const { accent, onAccent } = useAccent();
  const reduce = useReduceMotion();
  // Lazy state init (not useRef.current) so the Animated.Value reads as a
  // plain value in render — the shape the hooks lint rules want.
  const [fill] = useState(() => new Animated.Value(focused ? 1 : 0));
  useEffect(() => {
    if (reduce) {
      fill.setValue(focused ? 1 : 0);
      return;
    }
    Animated.timing(fill, {
      toValue: focused ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [focused, reduce, fill]);
  return (
    <View style={styles.slot}>
      <Animated.View
        style={[styles.indicator, { backgroundColor: onAccent, opacity: fill, transform: [{ scale: fill }] }]}
        pointerEvents="none"
      />
      <View style={{ opacity: focused ? 1 : 0.45 }}>
        <Icon color={focused ? accent : onAccent} size={21} />
      </View>
    </View>
  );
}

/**
 * The centre "+". Rendered purely as `tabBarIcon` — the default tabBarButton
 * (left untouched) still handles the actual touch and still fires
 * `tabPress`, which the Tabs.Screen below intercepts to open the Add screen.
 * Always a solid contrast-colour circle so it stays the obvious action on
 * any accent.
 */
function CenterAddButton() {
  const { accent, onAccent } = useAccent();
  return (
    <View style={styles.slot}>
      <View style={[styles.plus, { backgroundColor: onAccent }]} pointerEvents="none" />
      <Feather name="plus" size={21} color={accent} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { accent } = useAccent();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        // A quick cross-fade between tabs rather than an instant cut.
        animation: 'fade',
        // A floating pill in the user's accent colour, clear of the device's
        // own gesture bar. It sits above the content (position: absolute);
        // the tab screens all pad their scroll views past it via
        // theme.layout.tabScreenScrollPad.
        tabBarStyle: {
          position: 'absolute',
          left: theme.layout.tabBar.sideInset,
          right: theme.layout.tabBar.sideInset,
          bottom: insets.bottom + theme.layout.tabBar.bottomGap,
          height: theme.layout.tabBar.height,
          borderRadius: theme.radius.pill,
          backgroundColor: accent,
          borderTopWidth: 0,
          paddingHorizontal: 6,
          shadowColor: theme.colors.ink,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
          elevation: 10,
        },
        tabBarItemStyle: { height: theme.layout.tabBar.height, paddingTop: 0, paddingBottom: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon Icon={HomeIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Activity',
          tabBarIcon: ({ focused }) => <TabIcon Icon={ActivityIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: () => <CenterAddButton />,
        }}
        listeners={{
          tabPress: (e) => {
            // Never navigate to the "add" route itself — it exists only so
            // this slot has a place in the pill; the real destination is the
            // Add screen, pushed onto the Stack.
            e.preventDefault();
            router.push('/add-transaction');
          },
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: 'Borrowed & Lent',
          tabBarIcon: ({ focused }) => <TabIcon Icon={LoanIcon} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ focused }) => <TabIcon Icon={ReportsIcon} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 44,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The active-tab chip — a soft rounded rectangle, slightly wider than tall,
  // sitting behind the icon.
  indicator: {
    position: 'absolute',
    top: 2,
    left: 3,
    right: 3,
    bottom: 2,
    borderRadius: 12,
  },
  plus: {
    position: 'absolute',
    top: 1,
    left: 5,
    right: 5,
    bottom: 1,
    borderRadius: theme.radius.pill,
  },
});
