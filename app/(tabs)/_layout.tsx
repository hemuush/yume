import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { Tabs, useFocusEffect } from 'expo-router';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { PillTabBar } from '@/components/PillTabBar';
import { openAdd } from '@/lib/openAdd';
import { DURATIONS } from '@/lib/motionTimings';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { schemeScreenLayout, useSchemeVersion } from '@/theme/SchemeBoundary';

/**
 * Switching tabs: the old screen goes at once and the new one fades in as a single flattened layer. Android fades a
 * plain view's children one by one, so a navigator cross-fade showed the screen behind through the cards and each
 * card's shadow through the card itself. The layer is held only for the fade: kept, it would slow scrolling.
 */
function TabFadeIn({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const [fading, setFading] = useState(false);
  const shownOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      // The first tab the app opens on is not "switched to".
      if (!shownOnce.current || reduce) {
        shownOnce.current = true;
        return;
      }
      opacity.setValue(0);
      setFading(true);
      const fade = Animated.timing(opacity, {
        toValue: 1,
        duration: DURATIONS.standard,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      fade.start(() => setFading(false));
      return () => {
        fade.stop();
        opacity.setValue(1);
        setFading(false);
      };
    }, [opacity, reduce])
  );
  return (
    <Animated.View
      style={{ flex: 1, opacity }}
      needsOffscreenAlphaCompositing
      renderToHardwareTextureAndroid={fading}
    >
      {children}
    </Animated.View>
  );
}

export default function TabsLayout() {
  const [repeatSheetVisible, setRepeatSheetVisible] = useState(false);
  const schemeVersion = useSchemeVersion();

  return (
    <>
      <Tabs
        // Each tab is drawn again when the colour mode changes; the bar above does so itself.
        screenLayout={({ children }) => <TabFadeIn>{schemeScreenLayout({ children })}</TabFadeIn>}
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
        // The navigator switches at once; the arriving screen fades itself in (TabFadeIn).
        screenOptions={{
          headerShown: false,
          // Behind the fade the page colour shows, not the navigator's light default.
          sceneStyle: { backgroundColor: theme.colors.background },
          animation: 'none',
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
