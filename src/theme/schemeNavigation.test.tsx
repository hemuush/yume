/**
 * Runs the real Expo Router 58 with the same screen layouts the app uses, to show what a change of colour mode
 * does to navigation: every screen is drawn again in the new mode, but where the person is stays put: the same
 * screen on top, the same tab selected, the screens beneath still beneath.
 */
import { useEffect } from 'react';
import { Text as RNText } from 'react-native';
import { Stack, Tabs, router } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { applyScheme } from './scheme';
import { schemeScreenLayout, stackScreenLayout } from './SchemeBoundary';

const mounts: Record<string, number> = {};
const unmounts: Record<string, number> = {};

const page = (name: string) =>
  function Page() {
    useEffect(() => {
      mounts[name] = (mounts[name] ?? 0) + 1;
      return () => {
        unmounts[name] = (unmounts[name] ?? 0) + 1;
      };
    }, []);
    return <RNText testID={`page-${name}`}>{name}</RNText>;
  };

const routes = {
  _layout: function Root() {
    return <Stack screenLayout={stackScreenLayout} screenOptions={{ headerShown: false }} />;
  },
  '(tabs)/_layout': function TabsLayout() {
    useEffect(() => {
      mounts.tabsNavigator = (mounts.tabsNavigator ?? 0) + 1;
    }, []);
    return (
      <Tabs screenLayout={schemeScreenLayout} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="plan" />
      </Tabs>
    );
  },
  '(tabs)/index': page('home'),
  '(tabs)/plan': page('plan'),
  detail: page('detail'),
};

beforeEach(() => {
  for (const key of Object.keys(mounts)) delete mounts[key];
  for (const key of Object.keys(unmounts)) delete unmounts[key];
  applyScheme('light');
});
afterAll(() => {
  applyScheme('light');
});

describe('a change of colour mode on the real router', () => {
  it('draws the tab on screen again and keeps the tab navigator and the selected tab', async () => {
    const view = await renderRouter(routes, { initialUrl: '/plan' });
    expect(view.getPathname()).toBe('/plan');
    expect(screen.getByTestId('page-plan')).toBeTruthy();
    const before = mounts.plan;

    await act(async () => {
      applyScheme('dark');
    });

    expect(view.getPathname()).toBe('/plan');
    expect(screen.getByTestId('page-plan')).toBeTruthy();
    expect(mounts.plan).toBe(before + 1);
    expect(unmounts.plan).toBe(1);
    expect(mounts.tabsNavigator).toBe(1);
  });

  it('draws a pushed screen again and keeps the screen under it, so Back still works', async () => {
    const view = await renderRouter(routes, { initialUrl: '/plan' });
    await act(async () => {
      router.push('/detail');
    });
    expect(view.getPathname()).toBe('/detail');
    expect(mounts.detail).toBe(1);

    await act(async () => {
      applyScheme('dark');
    });

    expect(view.getPathname()).toBe('/detail');
    expect(screen.getByTestId('page-detail')).toBeTruthy();
    expect(mounts.detail).toBe(2);
    // The tabs underneath keep their navigator (it is not drawn again), so the person returns to the same tab.
    expect(mounts.tabsNavigator).toBe(1);

    await act(async () => {
      router.back();
    });
    expect(view.getPathname()).toBe('/plan');
  });

  it('does nothing to the screens when the mode is applied again unchanged', async () => {
    await renderRouter(routes, { initialUrl: '/detail' });
    const before = { ...mounts };
    await act(async () => {
      applyScheme('light');
    });
    expect(mounts).toEqual(before);
  });
});
