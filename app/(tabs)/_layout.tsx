import { useEffect, useState } from 'react';
import { Tabs, router } from 'expo-router';
import { theme } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { PillTabBar } from '@/components/PillTabBar';
import { openAdd } from '@/lib/openAdd';
import { runWhenIdle } from '@/lib/runWhenIdle';
import { schemeScreenLayout, useSchemeVersion } from '@/theme/SchemeBoundary';

/** The tabs built in the background once Home has settled, so the first tap on each is instant. */
const PRELOADED_TABS = ['/transactions', '/plan', '/reports'] as const;

export default function TabsLayout() {
  const [repeatSheetVisible, setRepeatSheetVisible] = useState(false);
  const schemeVersion = useSchemeVersion();
  useEffect(() => {
    // One at a time, each on an idle moment, so building them never stalls what is on screen.
    const next = (i: number) => {
      if (i >= PRELOADED_TABS.length) return;
      runWhenIdle(() => {
        router.prefetch(PRELOADED_TABS[i]);
        next(i + 1);
      }, 4000);
    };
    next(0);
  }, []);

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
