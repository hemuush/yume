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
 * A tab's icon in the docked bar. The bar itself is always the app's own
 * cream surface — never the accent (see the redesign note below) — so the
 * accent only ever has to stay legible inside one small pill, not across an
 * entire bar. Inactive icons are plain ink at low opacity; the active tab
 * gets a pill in the accent colour with the icon punched through in the
 * contrast colour. Fades + scales in over 160ms rather than springing.
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
        style={[styles.indicator, { backgroundColor: accent, opacity: fill, transform: [{ scale: fill }] }]}
        pointerEvents="none"
      />
      <View style={{ opacity: focused ? 1 : 0.4 }}>
        <Icon color={focused ? onAccent : theme.colors.ink} size={20} />
      </View>
    </View>
  );
}

/**
 * The centre "+". Rendered purely as `tabBarIcon` — the default tabBarButton
 * (left untouched) still handles the actual touch and still fires
 * `tabPress`, which the Tabs.Screen below intercepts to open the Add screen.
 * Always a plain ink circle, deliberately independent of the accent — the
 * one thing on the bar that should never change colour with the theme.
 */
function CenterAddButton() {
  return (
    <View style={styles.slot}>
      <View style={styles.plus} pointerEvents="none" />
      <Feather name="plus" size={20} color={theme.colors.surface} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        // A quick cross-fade between tabs rather than an instant cut.
        animation: 'fade',
        // Docked flush to the bottom edge in the app's own cream surface —
        // never the accent colour. An earlier floating, accent-filled pill
        // broke badly at both ends of the accent picker (nearly invisible
        // on Cream, a heavy black slab on Ink); a neutral bar can never
        // break regardless of which accent is picked. The device's own
        // safe-area inset becomes the bar's bottom padding instead of empty
        // page below it; tab screens clear it via theme.layout.
        // tabScreenScrollPad.
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: theme.layout.tabBar.height + insets.bottom,
          paddingBottom: insets.bottom,
          borderTopLeftRadius: theme.layout.tabBar.topRadius,
          borderTopRightRadius: theme.layout.tabBar.topRadius,
          backgroundColor: theme.colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.borderSoft,
          shadowColor: theme.colors.ink,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
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
    width: 42,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The active-tab pill — a soft rounded rectangle behind the icon.
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
    top: 2,
    left: 6,
    right: 6,
    bottom: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
});
