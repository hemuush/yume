import { useState } from 'react';
import { Animated, Easing } from 'react-native';
import { Tabs } from 'expo-router';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { PillTabBar } from '@/components/PillTabBar';
import { openAdd } from '@/lib/openAdd';
import { DURATIONS } from '@/lib/motionTimings';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { schemeScreenLayout, useSchemeVersion } from '@/theme/SchemeBoundary';

/**
 * Switching tabs is a fade-through: the screen you leave fades out and shrinks a hair in the first half, then the
 * new one fades in and settles to full size in the second. They never show together, so there is no ghost of a
 * header over another screen, and nothing slides sideways. One function of `progress` (0 = shown, 1 = a screen away)
 * does both: it falls to 0 by half way, which for the leaving screen is early on and for the arriving one is late.
 */
function tabSwitch({ current }: { current: { progress: Animated.Value } }) {
  const at = (outputRange: number[]) =>
    current.progress.interpolate({ inputRange: [-1, -0.5, 0, 0.5, 1], outputRange });
  return {
    sceneStyle: {
      opacity: at([0, 0, 1, 0, 0]),
      transform: [{ scale: at([0.97, 0.97, 1, 0.97, 0.97]) }],
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
              void openAdd();
            }}
            // Long-press: the "Log again" sheet, the user's most repeated entries saved for today in one tap.
            onAddLongPress={() => setRepeatSheetVisible(true)}
          />
        )}
        // Switching tabs is a 200 ms fade-through (see tabSwitch); with reduced motion
        // it is instant.
        screenOptions={{
          headerShown: false,
          // Behind a cross-fade the page colour shows, not the navigator's light default.
          sceneStyle: { backgroundColor: theme.colors.background },
          animation: reduce ? 'none' : 'shift',
          sceneStyleInterpolator: tabSwitch,
          transitionSpec: {
            animation: 'timing',
            config: { duration: DURATIONS.standard, easing: Easing.out(Easing.quad) },
          },
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
