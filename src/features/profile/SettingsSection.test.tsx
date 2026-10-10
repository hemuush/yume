/**
 * Profile's Settings tab: a coral note only while backups need attention; groups in signed-off order (Money,
 * Privacy & alerts, Your data, Appearance, About footer); rows that change something still do.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, [cb]),
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.4.0' }));
jest.mock('@/components/YumeLogo', () => ({ YumeLogo: () => null }));
// The real switch animates its knob after every render; only its value and onChange matter here.
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: () => null }));

const mockBackupResult = jest.fn();
const mockSetCurrency = jest.fn<Promise<void>, [string]>(async () => {});
const mockSetDailyGoal = jest.fn<Promise<void>, [number | null]>(async () => {});
jest.mock('@/db/settings', () => ({
  SUPPORTED_CURRENCIES: [
    { code: 'INR', label: 'Indian Rupee' },
    { code: 'USD', label: 'US Dollar' },
  ],
  getDefaultCurrency: async () => 'INR',
  setDefaultCurrency: (code: string) => mockSetCurrency(code),
  getDailySpendingGoal: async () => 50000,
  setDailySpendingGoal: (minor: number | null) => mockSetDailyGoal(minor),
  getNotificationPrefs: async () => ({
    morningEnabled: true,
    eveningEnabled: false,
    overspendAlerts: true,
    billAlerts: false,
    weeklySummary: true,
    suuCheckins: true,
  }),
  getLastLocalBackupResult: () => mockBackupResult(),
}));
const mockTidyReport = { repeats: [], startingBalances: [], fractionalCount: 0 };
jest.mock('@/db/tidyUp', () => ({
  getTidyUpReport: async () => mockTidyReport,
  tidyUpCount: (r: typeof mockTidyReport) =>
    r.repeats.length + r.startingBalances.length + (r.fractionalCount > 0 ? 1 : 0),
}));
const mockDeviceSecured = jest.fn();
jest.mock('@/lib/appLock', () => ({ isDeviceSecured: () => mockDeviceSecured() }));
const mockLock = { lockEnabled: true, setLockEnabled: jest.fn() };
jest.mock('@/lib/AppLockContext', () => ({ useAppLock: () => mockLock }));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));
const mockSetTheme = jest.fn();
jest.mock('@/theme/AccentContext', () => ({
  THEMES: jest.requireActual('@/theme/themes').THEMES,
  useAccent: () => ({ accent: '#8FCBFF', onAccent: '#12130F', themeId: 'yume', setTheme: mockSetTheme }),
}));

import { SettingsSection, daysAgoLabel } from './SettingsSection';
import { router } from 'expo-router';
import { showAlert } from '@/components/AppDialog';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SettingsSection />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the load settle
  });
  return tree;
}

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

/** Presses the first pressable whose accessibility label, or own text, is `label`. */
async function press(tree: ReactTestRenderer, label: string) {
  const node = tree.root.find(
    (n) =>
      typeof n.props.onPress === 'function' &&
      (n.props.accessibilityLabel === label ||
        n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label))
  );
  await act(async () => {
    await node.props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLock.lockEnabled = true;
  mockBackupResult.mockResolvedValue({ at: daysAgo(1), ok: true, sizeBytes: 1000 });
});

// Loads React Native's lazily-required components once, up front, with a
// generous budget — on a cold run their first load can outlast one test's.
beforeAll(async () => {
  mockBackupResult.mockResolvedValue(null);
  await render();
}, 180000);

describe('Profile · Settings section', () => {
  it('does not report Never backed up when the backup status read fails, and offers Retry', async () => {
    mockBackupResult.mockRejectedValueOnce(new Error('offline'));
    const tree = await render();
    expect(texts(tree)).not.toContain('Never backed up');
    expect(texts(tree)).toContain("Some settings couldn't be read");
    await press(tree, 'Retry');
    expect(texts(tree)).toContain('Last backup yesterday');
    act(() => tree.unmount());
  });
  it('stays quiet about backups when the last one worked', async () => {
    const shown = texts(await render());
    expect(shown).not.toContain('Backup failed');
    expect(shown).not.toContain('No backup yet');
    expect(shown).toContain('Last backup yesterday');
  });

  it('says so in the safety check when the last backup failed, and opens Backup from it', async () => {
    mockBackupResult.mockResolvedValue({ at: daysAgo(0), ok: false, error: 'folder gone' });
    const tree = await render();
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Your last backup didn’t finish',
        'Failed · tap to check',
        'Last backup failed — tap to check',
      ])
    );
    await press(tree, 'Backup: Failed · tap to check. Open Backup & restore');
    expect(router.push).toHaveBeenCalledWith('/backup');
  });

  it('counts a missing backup as a thing to look at when there has never been one', async () => {
    mockBackupResult.mockResolvedValue(null);
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['1 thing to look at', 'Never backed up']));
    await press(tree, 'Backup: Never backed up. Open Backup & restore');
    expect(router.push).toHaveBeenCalledWith('/backup');
  });

  it('reads all clear when backed up with unlock on', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining(['Your data is looked after', 'Yesterday', 'Needed to open'])
    );
  });

  it('turns unlock on from the safety check, through the same screen-lock check as its row', async () => {
    mockLock.lockEnabled = false;
    mockDeviceSecured.mockResolvedValue(true);
    const tree = await render();
    await press(tree, 'Require unlock, off. Tap to turn it on');
    expect(mockLock.setLockEnabled).toHaveBeenCalledWith(true);
  });

  it('lists the groups in the signed-off order', async () => {
    const shown = texts(await render());
    const order = ['Money', 'Privacy & alerts', 'Your data', 'Appearance', 'Yume · v1.4.0'].map((g) =>
      shown.indexOf(g)
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('keeps About behind the footer link until it is opened', async () => {
    const tree = await render();
    expect(texts(tree)).not.toContain('Track every rupee, on your terms.');
    await press(tree, 'About Yume');
    expect(texts(tree)).toContain('Track every rupee, on your terms.');
    await press(tree, 'About Yume');
    expect(texts(tree)).not.toContain('Track every rupee, on your terms.');
  });

  it('keeps every setting row with its current value', async () => {
    const shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining([
        'Default currency',
        'INR',
        'Daily spending goal',
        '₹500/day',
        'Categories',
        'Require unlock',
        'Hide savings & investment amounts',
        'Notifications',
        '4 of 6 on',
        'Backup & restore',
        'Last backup yesterday',
        'Tidy up',
        'All tidy',
        'Yume · v1.4.0',
        'Works fully offline.',
      ])
    );
  });

  it('changes the currency from the list that opens in place', async () => {
    const tree = await render();
    expect(texts(tree)).not.toContain('US Dollar');
    await press(tree, 'Default currency');
    await press(tree, 'US Dollar');
    expect(mockSetCurrency).toHaveBeenCalledWith('USD');
    expect(texts(tree)).not.toContain('US Dollar'); // closes on pick
  });

  it('saves a new daily goal, and rejects an empty one', async () => {
    const tree = await render();
    await press(tree, 'Daily spending goal');
    const input = tree.root.findByType(TextInput);
    act(() => input.props.onChangeText(''));
    await press(tree, 'Save');
    expect(texts(tree)).toContain('Enter a valid daily amount');
    expect(mockSetDailyGoal).not.toHaveBeenCalled();

    act(() => input.props.onChangeText('800'));
    await press(tree, 'Save');
    expect(mockSetDailyGoal).toHaveBeenCalledWith(80000);
    expect(texts(tree)).toContain('₹800/day');
  });

  it('shows the current theme and opens the Theme page to change it', async () => {
    const tree = await render();
    expect(texts(tree)).toContain('Yume');
    await press(tree, 'Theme: Yume. Change theme');
    expect(router.push).toHaveBeenCalledWith('/themes');
    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  it("won't turn the lock on when the phone itself has no screen lock", async () => {
    mockLock.lockEnabled = false;
    mockDeviceSecured.mockResolvedValue(false);
    const alert = jest.mocked(showAlert);
    const tree = await render();
    // The first switch is Require unlock; Hide amounts comes after it.
    const [toggle] = tree.root.findAll(
      (n) => n.props.value === false && typeof n.props.onChange === 'function'
    );
    await act(async () => {
      await toggle.props.onChange(true);
    });
    expect(alert).toHaveBeenCalledWith('No screen lock found', expect.any(String));
    expect(mockLock.setLockEnabled).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('reports a failed native security check without changing the lock preference', async () => {
    mockLock.lockEnabled = false;
    mockDeviceSecured.mockRejectedValue(new Error('Native check failed'));
    const tree = await render();
    const [toggle] = tree.root.findAll(
      (node) => node.props.value === false && typeof node.props.onChange === 'function'
    );
    await act(async () => {
      await toggle.props.onChange(true);
    });
    expect(showAlert).toHaveBeenCalledWith("Couldn't check the device lock", 'Native check failed');
    expect(mockLock.setLockEnabled).not.toHaveBeenCalled();
  });

  it('counts what Tidy up has found, and opens it', async () => {
    mockTidyReport.fractionalCount = 3;
    const tree = await render();
    expect(texts(tree)).toContain('1 thing to check');
    await press(tree, 'Tidy up');
    expect(router.push).toHaveBeenCalledWith('/tidy-up');
    mockTidyReport.fractionalCount = 0;
  });
});

describe('daysAgoLabel', () => {
  const now = new Date(2026, 8, 26, 9, 0);
  it('says today, yesterday, or how many days ago, by calendar day', () => {
    expect(daysAgoLabel(new Date(2026, 8, 26, 0, 5).toISOString(), now)).toBe('today');
    expect(daysAgoLabel(new Date(2026, 8, 25, 23, 58).toISOString(), now)).toBe('yesterday');
    expect(daysAgoLabel(new Date(2026, 8, 22, 12).toISOString(), now)).toBe('4 days ago');
  });
});
