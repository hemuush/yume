const mockRequest = jest.fn(() => Promise.resolve());
jest.mock('react-native-android-widget', () => ({
  requestWidgetUpdate: (...a: unknown[]) => mockRequest(...(a as [])),
}));
jest.mock('./registry', () => ({ WIDGET_NAMES: ['A', 'B'], renderWidgetByName: jest.fn() }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare' },
  ExecutionEnvironment: { StoreClient: 'storeClient', Bare: 'bare' },
}));
import Constants from 'expo-constants';
import { refreshAllWidgets } from './notifyWidgets';

const env = Constants as unknown as { executionEnvironment: string };

describe('refreshAllWidgets', () => {
  it('asks every widget to refresh in a real build', () => {
    env.executionEnvironment = 'bare';
    refreshAllWidgets();
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
  it('does nothing in Expo Go, where there is no widget module to warn about', () => {
    env.executionEnvironment = 'storeClient';
    refreshAllWidgets();
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
