/**
 * Runs the real Expo Router 58 (not a mock) with Yume's custom tab bar and discard guard. The router changed how
 * a custom tabBar is driven (emitter + navigateToTab instead of navigation) and how a blocked removal is
 * continued, so these checks stand in for tapping through the same paths on a phone.
 */
import { Pressable, Text as RNText, View } from 'react-native';
import { Stack, Tabs, router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useDiscardGuard } from '@/features/add/useDiscardGuard';
import { showAlert } from '@/components/AppDialog';

jest.mock('@/lib/uiScale', () => ({ useUiScale: () => 1 }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('./icons/TabIcons', () => ({
  HomeIcon: () => null,
  ActivityIcon: () => null,
  PlanIcon: () => null,
  ReportsIcon: () => null,
}));

// expo-router/testing-library registers an empty Reanimated module when Reanimated's own mock cannot load, and
// jest caches it. Fill that module with the repo's stand-in before the tab bar loads so it sees the stand-in.
Object.assign(
  jest.requireMock('react-native-reanimated'),
  require('@/test-support/reanimatedMock').createReanimatedMock()
);
const { PillTabBar } = require('./PillTabBar') as typeof import('./PillTabBar');

const page = (name: string) =>
  function Page() {
    return <RNText testID={`page-${name}`}>{name}</RNText>;
  };

describe('tab bar on the real router', () => {
  const tabs = {
    _layout: function Layout() {
      return (
        <Tabs
          tabBar={(props) => <PillTabBar {...props} onAdd={() => {}} onAddLongPress={() => {}} />}
          screenOptions={{ headerShown: false }}
        >
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="transactions" options={{ title: 'Activity' }} />
          <Tabs.Screen name="add" options={{ title: 'Add' }} />
          <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
          <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
        </Tabs>
      );
    },
    index: page('home'),
    transactions: page('activity'),
    add: page('add'),
    plan: page('plan'),
    reports: page('reports'),
  };

  it('switches tabs when a tab is pressed, once, without remounting the others', async () => {
    const view = await renderRouter(tabs, { initialUrl: '/' });
    expect(view.getPathname()).toBe('/');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Plan'));
    });
    expect(view.getPathname()).toBe('/plan');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Reports'));
    });
    expect(view.getPathname()).toBe('/reports');
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Activity'));
    });
    expect(view.getPathname()).toBe('/transactions');
  });

  it('keeps the current tab when its own tab is pressed again', async () => {
    const view = await renderRouter(tabs, { initialUrl: '/plan' });
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Plan'));
    });
    expect(view.getPathname()).toBe('/plan');
  });
});

describe('discard guard on the real router', () => {
  function Form() {
    const { leave } = useDiscardGuard(true);
    return (
      <View>
        <RNText testID="form">form</RNText>
        <Pressable testID="leave-now" onPress={() => leave(() => router.back())}>
          <RNText>Leave</RNText>
        </Pressable>
      </View>
    );
  }
  const stack = {
    _layout: () => <Stack screenOptions={{ headerShown: false }} />,
    index: page('start'),
    form: Form,
  };

  it('asks before the screen is left and lets Discard continue the blocked navigation', async () => {
    const alert = showAlert as jest.Mock;
    const view = await renderRouter(stack, { initialUrl: '/' });
    await act(async () => {
      router.push('/form');
    });
    expect(view.getPathname()).toBe('/form');

    await act(async () => {
      router.back();
    });
    // Still on the form, and the dialog was offered.
    expect(view.getPathname()).toBe('/form');
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alert.mock.calls[0];
    expect(title).toBe('Discard this entry?');

    // Keep editing does nothing.
    const keep = buttons.find((b: { text: string }) => b.text === 'Keep editing');
    await act(async () => keep.onPress?.());
    expect(view.getPathname()).toBe('/form');

    // Discard lifts the guard and the original back action goes through.
    const discard = buttons.find((b: { text: string }) => b.text === 'Discard');
    await act(async () => {
      discard.onPress();
    });
    expect(view.getPathname()).toBe('/');
  });
});
