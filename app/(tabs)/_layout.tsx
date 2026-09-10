import { useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { View, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { theme } from '@/constants/theme';
import { HomeIcon, ActivityIcon, LoanIcon, ReportsIcon } from '@/components/icons/TabIcons';
import { useReduceMotion } from '@/lib/useReduceMotion';

/**
 * A tab's icon inside the floating pill. The ink circle behind the active
 * tab grows and fades in as the indicator "lands" on it, and shrinks away
 * as you leave — a per-tab stand-in for a bar-wide sliding indicator.
 */
function TabIcon({ Icon, focused }: { Icon: typeof HomeIcon; focused: boolean }) {
  const reduce = useReduceMotion();
  // Lazy state init (not useRef.current) so the Animated.Value reads as a
  // plain value in render — the shape the hooks lint rules want.
  const [fill] = useState(() => new Animated.Value(focused ? 1 : 0));
  useEffect(() => {
    if (reduce) {
      fill.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(fill, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }, [focused, reduce, fill]);
  return (
    <View style={styles.circle}>
      <Animated.View
        style={[styles.circleFill, { opacity: fill, transform: [{ scale: fill }] }]}
        pointerEvents="none"
      />
      <Icon color={focused ? theme.colors.surface : theme.colors.ink} size={21} />
    </View>
  );
}

/**
 * The centre "+". Rendered purely as `tabBarIcon` — the default tabBarButton
 * (left untouched) still handles the actual touch and still fires
 * `tabPress`, which the Tabs.Screen below intercepts to open the Add screen.
 */
function CenterAddButton() {
  return (
    <View style={styles.circle}>
      <View style={[styles.circleFill, styles.circleFillStatic]} pointerEvents="none" />
      <Feather name="plus" size={21} color={theme.colors.surface} />
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
        // A floating sage pill, clear of the device's own gesture bar. It
        // sits above the content (position: absolute); the tab screens all
        // pad their scroll views past it.
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + 8,
          height: 58,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primary,
          borderTopWidth: 0,
          paddingHorizontal: 6,
          shadowColor: theme.colors.ink,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 10,
        },
        tabBarItemStyle: { height: 58, paddingTop: 0, paddingBottom: 0 },
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
  circle: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
  circleFillStatic: { opacity: 1 },
});
