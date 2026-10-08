import { useState } from 'react';
import { Tabs } from 'expo-router';
import { haptics } from '@/lib/haptics';
import { RepeatEntrySheet } from '@/features/home/RepeatEntrySheet';
import { PillTabBar } from '@/components/PillTabBar';
import { pushOnce } from '@/lib/pushOnce';

export default function TabsLayout() {
  const [repeatSheetVisible, setRepeatSheetVisible] = useState(false);

  return (
    <>
      <Tabs
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
        screenOptions={{ headerShown: false }}
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
      <RepeatEntrySheet visible={repeatSheetVisible} onClose={() => setRepeatSheetVisible(false)} />
    </>
  );
}
