import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { EASE_OUT } from '@/lib/motionTimings';
import { Tabs, router, useIsFocused } from 'expo-router';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { PillTabBar } from '@/components/PillTabBar';
import { openAdd } from '@/lib/openAdd';
import { runWhenIdle } from '@/lib/runWhenIdle';
import { schemeScreenLayout, useSchemeVersion } from '@/theme/SchemeBoundary';

/** The tabs built in the background once Home has settled, so the first tap on each is instant. */
const PRELOADED_TABS = ['/transactions', '/plan', '/reports'] as const;

/**
 * Fades a tab in by fading out a plain page-coloured sheet over it. The screen itself never goes translucent, so
 * Android cannot show its card shadows or the previous tab through it.
 */
function TabFade({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const reduce = useReduceMotion();
  const [cover] = useState(() => new Animated.Value(0));
  const wasFocused = useRef(focused);
  useLayoutEffect(() => {
    if (focused && !wasFocused.current && !reduce) {
      cover.setValue(1);
      Animated.timing(cover, {
        toValue: 0,
        duration: 260,
        easing: EASE_OUT,
        useNativeDriver: true,
      }).start();
    }
    wasFocused.current = focused;
  }, [focused, cover, reduce]);
  // The same value lifts the whole tab a little as it clears, so it rises into place (a move, never a see-through).
  const rise = cover.interpolate({ inputRange: [0, 1], outputRange: [0, 14] });
  return (
    <Animated.View style={{ flex: 1, transform: [{ translateY: rise }] }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background, opacity: cover }]}
      />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const [repeatSheetVisible, setRepeatSheetVisible] = useState(false);
  const schemeVersion = useSchemeVersion();
  useEffect(() => {
    // One at a time, each on an idle moment, so building them never stalls what is on screen. Stops when the tabs go
    // (a restore resets the app): a late one would build a tab for a navigator that is gone.
    let stopped = false;
    const next = (i: number) => {
      if (stopped || i >= PRELOADED_TABS.length) return;
      runWhenIdle(() => {
        if (stopped) return;
        router.prefetch(PRELOADED_TABS[i]);
        next(i + 1);
      }, 4000);
    };
    next(0);
    return () => {
      stopped = true;
    };
  }, []);

  return (
    <>
      <Tabs
        // Each tab is drawn again when the colour mode changes; the bar above does so itself.
        screenLayout={(props) => <TabFade>{schemeScreenLayout(props)}</TabFade>}
        // Plain views, not native screens: Android's native screen container cross-faded tabs (~100 ms) even with
        // animation 'none', showing both screens and every card's shadow through them (seen frame by frame).
        detachInactiveScreens={false}
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
        // Tabs switch at once, as in native apps: a fade on Android showed the screen behind through every card, and
        // the tabs are built ahead (PRELOADED_TABS) so there is nothing to cover up.
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
