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
