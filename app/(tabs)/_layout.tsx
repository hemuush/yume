import { useState } from 'react';
import { Animated } from 'react-native';
import { Tabs } from 'expo-router';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { PillTabBar } from '@/components/PillTabBar';
import { pushOnce } from '@/lib/pushOnce';
import { DURATIONS } from '@/lib/motionTimings';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { schemeScreenLayout, useSchemeVersion } from '@/theme/SchemeBoundary';

/**
 * Switching tabs: the leaving and the arriving screen fade while drifting 12 dp sideways, toward the tab that was
 * tapped (a lower tab leaves to the left). The built-in shift moves 50 dp, which reads as a slide, not a nudge.
 */
function tabSwitch({ current }: { current: { progress: Animated.Value } }) {
  const at = (inputRange: number[], outputRange: number[]) =>
    current.progress.interpolate({ inputRange, outputRange });
  return {
    sceneStyle: {
      opacity: at([-1, 0, 1], [0, 1, 0]),
      transform: [{ translateX: at([-1, 0, 1], [-12, 0, 12]) }],
    },
  };
}

export default function TabsLayout() {
  const [repeatSheetVisible, setRepeatSheetVisible] = useState(false);
  const reduce = useReduceMotion();
  const schemeVersion = useSchemeVersion();

  return (
    <>
      <Tabs
        // Each tab is drawn again when the colour mode changes; the bar above does so itself.
        screenLayout={schemeScreenLayout}
        // The floating pill (PillTabBar): four tabs in a frosted pill and a round Add beside it.
        tabBar={(props) => (
          <PillTabBar
            {...props}
            // Never navigate to the "add" route itself (it only holds a slot); Add is pushed onto the Stack.
            onAdd={() => {
              haptics.tap();
              pushOnce('/add-transaction');
            }}
            // Long-press: the "Log again" sheet, the user's most repeated entries saved for today in one tap.
            onAddLongPress={() => setRepeatSheetVisible(true)}
          />
        )}
        // Switching tabs fades and nudges the screens sideways (see tabSwitch, 220 ms); with reduced motion
        // it is instant.
        screenOptions={{
          headerShown: false,
          // Behind a cross-fade the page colour shows, not the navigator's light default.
          sceneStyle: { backgroundColor: theme.colors.background },
          animation: reduce ? 'none' : 'shift',
          sceneStyleInterpolator: tabSwitch,
          transitionSpec: { animation: 'timing', config: { duration: DURATIONS.slideIn } },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="transactions" options={{ title: 'Activity' }} />
        {/* Kept as a route so old links to /add still resolve; the bar draws Add as its own button. */}
        <Tabs.Screen name="add" options={{ title: 'Add' }} />
        {/* Plan replaced a Borrowed & Lent tab — Loans and Friends & Family
          are tiles on Plan beside budgets, goals and recurring. */}
        <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
        <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      </Tabs>
      <RepeatEntrySheet
        key={schemeVersion}
        visible={repeatSheetVisible}
        onClose={() => setRepeatSheetVisible(false)}
      />
    </>
  );
}
