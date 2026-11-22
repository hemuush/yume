/** Profile’s Settings and You sections when every read fails: no crash, no invented values, a way to retry. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(60000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.4.0' }));
jest.mock('@/components/YumeLogo', () => ({ YumeLogo: () => null }));
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: () => null }));
jest.mock('@/widgets/notifyWidgets', () => ({ refreshAllWidgets: jest.fn() }));
// Every read rejects.
const mockBoom = async () => {
  throw new Error('disk gone');
};
jest.mock('@/db/settings', () => ({
  getAddStyle: () => Promise.reject(new Error('x')),
  setAddStyle: async () => {},
  getHideWidgetValues: () => Promise.reject(new Error('x')),
  setHideWidgetValues: async () => {},
  SUPPORTED_CURRENCIES: [{ code: 'INR', label: 'Indian Rupee' }],
  getDefaultCurrency: () => Promise.reject(new Error('x')),
  setDefaultCurrency: async () => {},
  getDailySpendingGoal: () => Promise.reject(new Error('x')),
  setDailySpendingGoal: async () => {},
  getNotificationPrefs: () => Promise.reject(new Error('x')),
  getLastLocalBackupResult: () => Promise.reject(new Error('x')),
}));
jest.mock('@/db/tidyUp', () => ({
  getTidyUpReport: () => Promise.reject(new Error('x')),
  tidyUpCount: () => 0,
}));
jest.mock('@/db/recentlyDeleted', () => ({ countDeletedEntries: () => Promise.reject(new Error('x')) }));
jest.mock('@/lib/appLock', () => ({ isDeviceSecured: () => Promise.reject(new Error('x')) }));
jest.mock('@/lib/AppLockContext', () => ({
  useAppLock: () => ({ lockEnabled: false, setLockEnabled: jest.fn() }),
}));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/theme/AppearanceContext', () => ({
  useAppearance: () => ({ preference: 'system', scheme: 'light', setPreference: jest.fn() }),
}));
jest.mock('@/db/ledger', () => ({ listAccounts: mockBoom, countTransactions: mockBoom }));
jest.mock('@/db/loans', () => ({ listLoans: mockBoom }));
jest.mock('@/db/people', () => ({ listPeople: mockBoom }));
jest.mock('./AddAccountModal', () => ({ AddAccountModal: () => null }));
jest.mock('./AccountDetailModal', () => ({ AccountDetailModal: () => null }));

import { SettingsSection } from './SettingsSection';
import { YouSection } from './YouSection';

const flat = (c: unknown): string =>
  Array.isArray(c) ? c.map(flat).join('') : c == null || typeof c === 'boolean' ? '' : String(c);
const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => flat(n.props.children));

async function mount(el: React.ReactElement) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(el);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return tree;
}

it('Settings renders with every read failing, says so, and invents no backup or value', async () => {
  const tree = await mount(<SettingsSection />);
  const shown = texts(tree);
  expect(shown).toContain('Some settings couldn’t be read');
  expect(shown).not.toContain('Never backed up');
  expect(shown).not.toContain('Last backup failed — tap to check');
  expect(shown).toContain('Retry');
  await act(async () => {
    tree.unmount();
  });
});

it('You renders with every read failing without throwing, and invents no balances', async () => {
  const tree = await mount(<YouSection />);
  expect(texts(tree).join(' ')).not.toMatch(/₹\d/);
  await act(async () => {
    tree.unmount();
  });
});
