// Fonts do nothing under Jest. Every @expo/vector-icons icon loads its font asynchronously on mount and then sets
// state, which logged a "not wrapped in act" error per icon and, with jest-expo 58 and React Native 0.88, also
// rejected because expo-asset reads an asset registry jest-expo does not stub. Report fonts as loaded instead.
jest.mock('expo-font', () => ({
  ...jest.requireActual('expo-font'),
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(async () => {}),
  useFonts: jest.fn(() => [true, null]),
}));

// jest-expo reports an Expo Go environment, so expo-notifications warns on every suite that imports it that push
// is unavailable. The tests only use local notifications, so drop that one message and keep every other warning.
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith('expo-notifications: Android Push notifications'))
    return;
  originalWarn(...args);
};

// expo-notifications registers a device-push-token listener at import time
// (DevicePushTokenAutoRegistration). In the Node test environment that leaves
// an open handle behind, which is why Jest reported "a worker process has
// failed to exit gracefully". None of the suites exercise the real native
// module — the ones that care already mock '@/lib/notifications' — so a
// blanket automock here removes the leak without changing any assertion.
jest.mock('expo-notifications');
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => {}),
  allowScreenCaptureAsync: jest.fn(async () => {}),
}));

// Yume's dialog (showAlert) draws through ModalSheet, which needs a native
// keyboard module tests don't have; screens' tests assert on the call itself.
jest.mock('@/components/AppDialog', () => ({ showAlert: jest.fn(), AppDialogHost: () => null }));

// Feature suites already replace native sheet shells. Exercise the real persistent window in
// ModalSheet.test.tsx; other suites keep their existing form/financial-flow harnesses.
jest.mock('@/components/SheetFlow', () => ({
  SheetFlow: ({ children }: { children: unknown }) => children,
  SheetFlowContext: require('react').createContext(null),
}));

// Wrap's share card is captured as a picture by a native module tests don't have.
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///wrap.png') }));

// react-test-renderer has no automatic cleanup. Dispose mounted trees after each test so real animation
// timers, keyboard/app-state listeners and date refresh timers cannot outlive their test environment.
// Use a plain wrapper rather than a Jest spy: resetAllMocks/restoreAllMocks must not disable cleanup.
const renderer = jest.requireActual<typeof import('react-test-renderer')>('react-test-renderer');
const originalCreate = renderer.create;
const mountedTrees = new Set<import('react-test-renderer').ReactTestRenderer>();
renderer.create = (...args: Parameters<typeof originalCreate>) => {
  const tree = originalCreate(...args);
  mountedTrees.add(tree);
  return tree;
};
afterEach(() => {
  if (mountedTrees.size === 0) return;
  try {
    renderer.act(() => {
      for (const tree of mountedTrees) tree.unmount();
    });
  } finally {
    mountedTrees.clear();
  }
});
