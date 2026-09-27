/**
 * Profile's Settings tab: the at-a-glance tiles reflect backup, lock and
 * alerts and open the right place; the groups come in their signed-off
 * order; and the rows that change something (currency, daily goal, theme,
 * lock) still do exactly what they did.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, TextInput, Alert } from 'react-native';

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
    reminderEnabled: true,
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

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

async function render(onJumpTo?: (y: number) => void) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<SettingsSection onJumpTo={onJumpTo} />);
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
  it('shows backup, lock and alerts at a glance, and the tiles open their screens', async () => {
    const tree = await render();
    expect(texts(tree)).toEqual(
      expect.arrayContaining([
        'Backed up',
        'Yesterday',
        'Lock on',
        'Fingerprint or PIN',
        '4 of 5',
        'Alerts on',
      ])
    );
    await press(tree, 'Backed up, Yesterday');
    expect(router.push).toHaveBeenCalledWith('/backup');
    await press(tree, '4 of 5, Alerts on');
    expect(router.push).toHaveBeenCalledWith('/notification-settings');
  });

  it('flags a failed backup and a missing one in the tile and in the row', async () => {
    mockBackupResult.mockResolvedValue({ at: daysAgo(0), ok: false, error: 'folder gone' });
    let shown = texts(await render());
    expect(shown).toEqual(
      expect.arrayContaining(['Backup failed', 'Tap to check', 'Last backup failed — tap to check'])
    );

    mockBackupResult.mockResolvedValue(null);
    shown = texts(await render());
    expect(shown).toEqual(expect.arrayContaining(['No backup', 'Set one up', 'Never backed up']));
  });

  it('scrolls to Privacy & security from the lock tile', async () => {
    const onJumpTo = jest.fn();
    const tree = await render(onJumpTo);
    const privacyGroup = tree.root.find((n) => typeof n.props.onLayout === 'function');
    act(() =>
      privacyGroup.props.onLayout({ nativeEvent: { layout: { x: 0, y: 640, width: 360, height: 200 } } })
    );
    await press(tree, 'Lock on, Fingerprint or PIN');
    expect(onJumpTo).toHaveBeenCalledWith(640);
  });

  it('lists the groups in the signed-off order', async () => {
    const shown = texts(await render());
    const order = ['Money', 'Privacy & security', 'Alerts & backup', 'Appearance', 'About'].map((g) =>
      shown.indexOf(g)
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
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
        '4 of 5 on',
        'Backup & Restore',
        'Last backup yesterday',
        'Tidy up',
        'All tidy',
        'Yume',
        'v1.4.0',
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

  it('applies a theme with one tap on its swatch', async () => {
    const tree = await render();
    await press(tree, 'Theme Hollow Violet, Indigo & peach');
    expect(mockSetTheme).toHaveBeenCalledWith('hollowViolet');
  });

  it("won't turn the lock on when the phone itself has no screen lock", async () => {
    mockLock.lockEnabled = false;
    mockDeviceSecured.mockResolvedValue(false);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await render();
    expect(texts(tree)).toEqual(expect.arrayContaining(['Lock off', 'Anyone can open']));
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
