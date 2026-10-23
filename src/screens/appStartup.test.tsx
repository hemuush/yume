/**
 * The real root layout, tab layout and Home screen started under the real Expo Router (every other screen test
 * replaces the router), the way the app opens on a fresh install and on a phone that has been set up. A crash while
 * starting, the error screen, or any console error fails it. The database is a real SQLite engine; the native
 * pieces (notifications, keyboard, haptics) are stand-ins.
 */
import { Text } from 'react-native';
import { createRealDataTestDb, AsyncDb } from '@/test-support/realDataTestDb';

jest.setTimeout(60000);
let mockDb: AsyncDb;
jest.mock('@/db/client', () => ({ ...jest.requireActual('@/db/client'), getDb: async () => mockDb }));
jest.mock('@/lib/haptics', () => ({
  haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn(), select: jest.fn() },
}));
jest.mock('@/lib/notifications', () => ({
  ...jest.requireActual('@/lib/notificationPlan'),
  rebuildNotifications: async () => true,
  ensureAndroidChannel: async () => {},
  cancelLegacyScheduledNotifications: async () => {},
  subscribeToNotificationTaps: () => () => {},
}));
jest.mock('react-native-keyboard-controller', () => ({
  useKeyboardState: () => false,
  KeyboardAwareScrollView: require('react-native').ScrollView,
  KeyboardStickyView: require('react-native').View,
  KeyboardAvoidingView: require('react-native').View,
  KeyboardProvider: ({ children }: { children: unknown }) => children,
}));
import { renderRouter, screen, act } from 'expo-router/testing-library';

// expo-router/testing-library installs an empty Reanimated module when Reanimated's own mock cannot load; fill it
// with the repo's stand-in plus the few helpers the Home screen calls.
Object.assign(
  jest.requireMock('react-native-reanimated'),
  require('@/test-support/reanimatedMock').createReanimatedMock(),
  {
    interpolateColor: (_value: number, _input: number[], output: string[]) => output[0],
    interpolate: (_value: number, _input: number[], output: number[]) => output[0],
    runOnJS: (fn: unknown) => fn,
    runOnUI: (fn: unknown) => fn,
    useAnimatedReaction: () => {},
    useDerivedValue: (fn: () => unknown) => ({ value: fn(), get: fn, set: () => {} }),
  }
);

const stub = (name: string) =>
  function Stub() {
    return <Text>{name}</Text>;
  };

function visibleText(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => visibleText(n, out));
  else (node as { children?: unknown[] }).children?.forEach((c) => visibleText(c, out));
  return out;
}

async function start(seed: (db: AsyncDb) => Promise<void> = async () => {}) {
  mockDb = createRealDataTestDb();
  await mockDb.execAsync(require('@/db/schema').CREATE_TABLES_SQL);
  await seed(mockDb);
  const errors: string[] = [];
  const spy = jest.spyOn(console, 'error').mockImplementation((...args) => {
    const message = String(args[0]).slice(0, 300);
    // React objects to stepping fake timers inside an async act, which is how this harness has to start the app.
    if (!message.startsWith('You called act(async')) errors.push(message);
  });
  const root = require('../../app/_layout');
  const view = await renderRouter(
    {
      _layout: { default: root.default, unstable_settings: root.unstable_settings },
      '(tabs)/_layout': require('../../app/(tabs)/_layout').default,
      '(tabs)/index': require('../../app/(tabs)/index').default,
      '(tabs)/transactions': stub('activity'),
      '(tabs)/add': stub('add'),
      '(tabs)/plan': stub('plan'),
      '(tabs)/reports': stub('reports'),
      'add-transaction': stub('add-transaction'),
    },
    { initialUrl: '/' }
  );
  // The router test harness runs on fake timers; step them so startup effects and loads can finish.
  for (let i = 0; i < 12; i++)
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(300);
    });
  const text = visibleText(screen.toJSON());
  spy.mockRestore();
  return { path: view.getPathname(), text, errors };
}

it('opens on the welcome screen on a fresh install', async () => {
  const { path, text, errors } = await start();
  expect(path).toBe('/');
  expect(text).toContain('Welcome');
  expect(text).not.toContain('Something went wrong');
  expect(errors).toEqual([]);
});

it('opens on Home inside the tabs on a phone that is already set up', async () => {
  const { path, text, errors } = await start(async (db) => {
    await db.runAsync("INSERT INTO settings (key, value) VALUES ('has_onboarded', '1')");
  });
  expect(path).toBe('/');
  expect(text).toContain('Home');
  expect(text).not.toContain('Something went wrong');
  expect(errors).toEqual([]);
});
