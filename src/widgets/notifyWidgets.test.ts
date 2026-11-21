const mockRequest = jest.fn(() => Promise.resolve());
jest.mock('react-native-android-widget', () => ({
  requestWidgetUpdate: (...a: unknown[]) => mockRequest(...(a as [])),
}));
jest.mock('./registry', () => ({ WIDGET_NAMES: ['A', 'B'], renderWidgetByName: jest.fn() }));
const mockNative: { module: unknown } = { module: {} };
jest.mock('react-native', () => ({
  NativeModules: {},
  TurboModuleRegistry: { get: () => mockNative.module },
}));
import { refreshAllWidgets } from './notifyWidgets';

describe('refreshAllWidgets', () => {
  beforeEach(() => mockRequest.mockClear());
  it('asks every widget to refresh in a real build', () => {
    mockNative.module = {};
    refreshAllWidgets();
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
  it('does nothing without the native module (Expo Go), where each call would only warn', () => {
    mockNative.module = null;
    refreshAllWidgets();
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
