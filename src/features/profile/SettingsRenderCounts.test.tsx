/**
 * What the Settings tab draws again for each thing done on it: opening the currency list, the daily goal field or About,
 * and typing in the goal, draw that part alone, not every row of the page.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.4.0' }));
jest.mock('@/components/YumeLogo', () => ({ YumeLogo: () => null }));
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: () => null }));
jest.mock('@/widgets/notifyWidgets', () => ({ refreshAllWidgets: jest.fn() }));
jest.mock('@/components/AmountField', () => ({
  AmountField: (props: any) =>
    require('react').createElement(require('react-native').View, { testID: 'goal-amount', ...props }),
}));
// Every settings row asks for its label once each time it is drawn.
const mockDrawn = { rows: [] as string[] };
jest.mock('@/components/SettingsRow', () => {
  const actual = jest.requireActual('@/components/SettingsRow');
  return {
    ...actual,
    SettingsRow: (props: { label: string }) => {
      mockDrawn.rows.push(props.label);
      return actual.SettingsRow(props);
    },
  };
});
jest.mock('@/db/settings', () => ({
  getHideWidgetValues: async () => false,
  setHideWidgetValues: async () => {},
  SUPPORTED_CURRENCIES: [
    { code: 'INR', label: 'Indian Rupee' },
    { code: 'USD', label: 'US Dollar' },
  ],
  getDefaultCurrency: async () => 'INR',
  setDefaultCurrency: async () => {},
  getDailySpendingGoal: async () => 50000,
  setDailySpendingGoal: async () => {},
  getNotificationPrefs: async () => ({
    morningEnabled: true,
    eveningEnabled: false,
    overspendAlerts: true,
    billAlerts: false,
    weeklySummary: true,
    suuCheckins: true,
  }),
  getLastLocalBackupResult: async () => ({ at: new Date().toISOString(), ok: true, sizeBytes: 1000 }),
}));
jest.mock('@/db/tidyUp', () => ({ getTidyUpReport: async () => ({}), tidyUpCount: () => 0 }));
jest.mock('@/lib/appLock', () => ({ isDeviceSecured: async () => true }));
jest.mock('@/lib/AppLockContext', () => ({
  useAppLock: () => ({ lockEnabled: true, setLockEnabled: jest.fn() }),
}));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/theme/AppearanceContext', () => ({
  useAppearance: () => ({ preference: 'system', scheme: 'light', setPreference: jest.fn() }),
}));

import { Text } from 'react-native';
import { SettingsSection } from './SettingsSection';

let mounted: ReactTestRenderer | null = null;
async function render() {
  await act(async () => {
    mounted = create(<SettingsSection />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return mounted!;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
const press = (tree: ReactTestRenderer, label: string) =>
  act(() => {
    tree.root
      .find((n) => typeof n.props.onPress === 'function' && n.props.accessibilityLabel === label)
      .props.onPress();
  });
const pressRow = (tree: ReactTestRenderer, label: string) =>
  act(() => {
    tree.root.find((n) => typeof n.props.onPress === 'function' && n.props.label === label).props.onPress();
  });

beforeEach(() => {
  mockDrawn.rows = [];
});
afterEach(() => {
  if (mounted) act(() => mounted!.unmount());
  mounted = null;
});

it('opens the currency list in place, and the About panel', async () => {
  const tree = await render();
  expect(mockDrawn.rows.length).toBeGreaterThan(8);
  pressRow(tree, 'Default currency');
  expect(texts(tree)).toContain('US Dollar');
  press(tree, 'About Yume');
  expect(texts(tree)).toContain('Track every rupee, on your terms.');
});

it('draws only the currency row when its list opens and closes', async () => {
  const tree = await render();
  const drawn = mockDrawn.rows.length;
  pressRow(tree, 'Default currency');
  pressRow(tree, 'Default currency');
  expect(mockDrawn.rows.slice(drawn)).toEqual(['Default currency', 'Default currency']);
});

it('draws no row when About opens and closes', async () => {
  const tree = await render();
  const drawn = mockDrawn.rows.length;
  press(tree, 'About Yume');
  press(tree, 'About Yume');
  expect(mockDrawn.rows.length).toBe(drawn);
});

it('draws only the daily goal row when it opens and while the amount is typed', async () => {
  const tree = await render();
  const drawn = mockDrawn.rows.length;
  pressRow(tree, 'Daily spending goal');
  expect(mockDrawn.rows.slice(drawn)).toEqual(['Daily spending goal']);
  expect(tree.root.findByProps({ testID: 'goal-amount' }).props.value).toBe('500');
  const afterOpen = mockDrawn.rows.length;
  act(() => tree.root.findByProps({ testID: 'goal-amount' }).props.onChangeText('6'));
  act(() => tree.root.findByProps({ testID: 'goal-amount' }).props.onChangeText('60'));
  expect(tree.root.findByProps({ testID: 'goal-amount' }).props.value).toBe('60');
  // The goal's own row is drawn with its field; no other row is.
  expect(new Set(mockDrawn.rows.slice(afterOpen))).toEqual(new Set(['Daily spending goal']));
});
