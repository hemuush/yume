import { useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { View, StyleSheet, Animated, Pressable, PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { Text } from '@/components/Text';
import { theme } from '@/constants/theme';
import { useAccent } from '@/theme/AccentContext';
import { HomeIcon, ActivityIcon, PlanIcon, ReportsIcon } from '@/components/icons/TabIcons';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { usePressScale } from '@/lib/usePressScale';
import { haptics } from '@/lib/haptics';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { DURATIONS } from '@/lib/motionTimings';

/**
 * The library's default tab button paints a native ripple over the whole touch target (a big grey circle
 * past the bar top). It's forced transparent; a `usePressScale` on the icon/indicator replaces it.
 */
function TabButton({ children, style, onPress, ...rest }: PressableProps & { children?: React.ReactNode }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.88);
  return (
    <Pressable
      {...rest}
      onPress={(e) => {
        // A light tick on every tab switch — only when it's a different tab.
        if (!rest.accessibilityState?.selected) haptics.tap();
        onPress?.(e);
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      android_ripple={{ color: 'transparent' }}
      style={style}
    >
      <Animated.View style={[styles.tabButtonInner, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Inactive icons: ink at this strength is 4.8:1 on the cream bar, over the 3:1 an icon needs. */
const INACTIVE_OPACITY = 0.62;

function TabLabel({ focused, children }: { focused: boolean; children: string }) {
  return (
    <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1} maxFontSizeMultiplier={1.15}>
      {children}
    </Text>
  );
}

/**
 * A tab's icon and name in the docked bar, always on the cream surface (never the accent), so the accent
 * needs legibility only in one small pill. Inactive: low-opacity ink; active: accent pill.
 */
function TabIcon({ Icon, focused, label }: { Icon: typeof HomeIcon; focused: boolean; label: string }) {
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
      duration: DURATIONS.quick,
      useNativeDriver: true,
    }).start();
  }, [focused, reduce, fill]);
  return (
    <View style={styles.item}>
      <View style={styles.slot}>
        <Animated.View
          style={[styles.indicator, { backgroundColor: accent, opacity: fill, transform: [{ scale: fill }] }]}
          pointerEvents="none"
        />
        <View style={{ opacity: focused ? 1 : INACTIVE_OPACITY }}>
          <Icon color={focused ? onAccent : theme.colors.ink} size={20} />
        </View>
      </View>
      <TabLabel focused={focused}>{label}</TabLabel>
    </View>
  );
}

/**
 * The centre "+", rendered only as `tabBarIcon`: the shared `TabButton` handles touch and fires `tabPress`,
 * which Tabs.Screen intercepts to open Add. Always a plain ink circle, never accent-themed.
 */
function CenterAddButton() {
  return (
    <View style={styles.item}>
      <View style={styles.slot}>
        <View style={styles.plus} pointerEvents="none" />
        <Feather name="plus" size={20} color={theme.colors.surface} />
      </View>
      <TabLabel focused={false}>Add</TabLabel>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [repeatSheetVisible, setRepeatSheetVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          // No custom transition: `animation: 'fade'` raced a tab's first lazy mount (blank screen). Docked
          // flush in cream, never the accent (a floating accent pill broke at picker extremes).
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
          tabBarButton: (props) => <TabButton {...props} />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon Icon={HomeIcon} focused={focused} label="Home" />,
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Activity',
            tabBarIcon: ({ focused }) => <TabIcon Icon={ActivityIcon} focused={focused} label="Activity" />,
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '',
            tabBarIcon: () => <CenterAddButton />,
            tabBarAccessibilityLabel: 'Add a transaction',
          }}
          listeners={{
            tabPress: (e) => {
              // Never navigate to the "add" route itself (it only holds the slot); the real destination is
              // the Add screen, pushed onto the Stack.
              e.preventDefault();
              router.push('/add-transaction');
            },
            // Long-press: the "Log again" sheet — the user's most repeated
            // entries, saved for today in one tap (see RepeatEntrySheet).
            tabLongPress: () => {
              haptics.tap();
              setRepeatSheetVisible(true);
            },
          }}
        />
        {/* Plan replaced a Borrowed & Lent tab — Loans and Friends & Family
          are tiles on Plan beside budgets, goals and recurring. */}
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ focused }) => <TabIcon Icon={PlanIcon} focused={focused} label="Plan" />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ focused }) => <TabIcon Icon={ReportsIcon} focused={focused} label="Reports" />,
          }}
        />
      </Tabs>
      <RepeatEntrySheet visible={repeatSheetVisible} onClose={() => setRepeatSheetVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  tabButtonInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  item: { alignItems: 'center', gap: 2, minWidth: 56 },
  slot: {
    width: 42,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: theme.font.bodyMedium, fontSize: 10.5, color: theme.colors.textSecondary },
  labelOn: { fontFamily: theme.font.bodyBold, color: theme.colors.textPrimary },
  // The active-tab pill — a soft rounded rectangle behind the icon.
  indicator: {
    position: 'absolute',
    top: 0,
    left: 1,
    right: 1,
    bottom: 0,
    borderRadius: 12,
  },
  plus: {
    position: 'absolute',
    top: 0,
    left: 5,
    right: 5,
    bottom: 0,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
  },
});
