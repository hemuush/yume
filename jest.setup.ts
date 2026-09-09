// expo-notifications registers a device-push-token listener at import time
// (DevicePushTokenAutoRegistration). In the Node test environment that leaves
// an open handle behind, which is why Jest reported "a worker process has
// failed to exit gracefully". None of the suites exercise the real native
// module — the ones that care already mock '@/lib/notifications' — so a
// blanket automock here removes the leak without changing any assertion.
jest.mock('expo-notifications');
