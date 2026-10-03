/**
 * First-run account step: picked starter accounts are created with typed balances, a failure keeps the user
 * there to retry without duplicating, Skip always exits, and "I have a Yume backup" restores into the app.
 */
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

// The first render loads React Native's component tree; on a cold parallel run (CI) that can exceed Jest's
// 5s default, so the timeout is generous.
jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-keyboard-controller', () => ({ KeyboardAvoidingView: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/SuuIllustration', () => ({ SuuIllustration: () => null }));
jest.mock('@/db/ledger', () => ({ createAccount: jest.fn() }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children, footer }: { visible: boolean; children: any; footer?: any }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));
const mockBackupFile = { current: '' };
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///backup.json' }] })),
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({ text: async () => mockBackupFile.current })),
}));
jest.mock('@/lib/appLock', () => ({ withoutRelock: (fn: () => unknown) => fn() }));
jest.mock('@/lib/backup', () => ({
  ...jest.requireActual('@/lib/backup'),
  getCurrentSummary: jest.fn(async () => ({ entries: 0, lastEntryDate: null, accounts: 0, loans: 0 })),
}));
jest.mock('@/lib/safetyCopy', () => ({
  ...jest.requireActual('@/lib/safetyCopy'),
  restoreKeepingSafetyCopy: jest.fn(async () => ({ skippedColumns: [], undoAvailable: true })),
}));
jest.mock('@/lib/restoreSync', () => ({ resyncAfterRestore: jest.fn(async () => {}) }));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  setHasOnboarded: jest.fn(async () => {}),
  setUserName: jest.fn(async () => {}),
}));

import { Onboarding } from './Onboarding';
import { createAccount } from '@/db/ledger';
import { setHasOnboarded } from '@/db/settings';
import { restoreKeepingSafetyCopy } from '@/lib/safetyCopy';
import { resyncAfterRestore } from '@/lib/restoreSync';
import { showAlert } from '@/components/AppDialog';

const createAccountMock = createAccount as jest.Mock;

async function render(onDone = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<Onboarding onDone={onDone} />);
  });
  return tree;
}

const cta = (tree: ReactTestRenderer) =>
  tree.root.find((n) => n.props.testID === 'onboarding-cta' && n.props.onPress);
const byLabel = (tree: ReactTestRenderer, label: string) =>
  tree.root.find((n) => n.props.accessibilityLabel === label && (n.props.onPress || n.props.onChangeText));

/**
 * The CTA fires its async work without returning it, so awaiting onPress doesn't wait. One macrotask lets
 * every queued promise (mocks resolve immediately) settle before asserting.
 */
async function press(node: ReactTestInstance) {
  await act(async () => {
    await node.props.onPress();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function goToAccountStep(tree: ReactTestRenderer) {
  for (let i = 0; i < 4; i++) await press(cta(tree)); // 3 intro slides + the name step
}

// Loads RN's lazily-required components once up front with a generous budget: a cold parallel run can outlast
// a test's limit. Walks to the account step, whose inputs only render there; loading in-test timed out.
beforeAll(async () => {
  createAccountMock.mockResolvedValue({});
  const tree = await render();
  await goToAccountStep(tree);
  await act(async () => {
    tree.unmount();
  });
}, 180000);

describe('Onboarding account step', () => {
  beforeEach(() => {
    createAccountMock.mockReset();
    createAccountMock.mockResolvedValue({});
    (setHasOnboarded as jest.Mock).mockClear();
  });

  it('creates the picked accounts with their typed balance, then finishes', async () => {
    const onDone = jest.fn();
    const tree = await render(onDone);
    await goToAccountStep(tree);

    await press(byLabel(tree, 'UPI wallet')); // off by default — turn it on
    await act(async () => {
      byLabel(tree, 'Bank account current balance').props.onChangeText('42500');
    });
    await press(cta(tree));

    expect(createAccountMock.mock.calls.map((c) => c[0])).toEqual([
      { name: 'Bank account', type: 'bank', openingBalanceMinor: 4250000 },
      { name: 'Cash', type: 'cash', openingBalanceMinor: 0 },
      { name: 'UPI wallet', type: 'wallet', openingBalanceMinor: 0 },
    ]);
    expect(setHasOnboarded).toHaveBeenCalledWith(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('an unpicked account is not created', async () => {
    const tree = await render();
    await goToAccountStep(tree);
    await press(byLabel(tree, 'Cash')); // on by default — turn it off
    await press(cta(tree));
    expect(createAccountMock.mock.calls.map((c) => c[0].name)).toEqual(['Bank account']);
  });

  it('on a failure it stays on the step, and a retry never creates the same account twice', async () => {
    const onDone = jest.fn();
    createAccountMock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('disk full'));
    const tree = await render(onDone);
    await goToAccountStep(tree);

    await press(cta(tree));
    expect(onDone).not.toHaveBeenCalled();
    const shown = tree.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(shown.some((t: string) => t.startsWith("Couldn't add every account"))).toBe(true);

    await press(cta(tree)); // retry
    expect(createAccountMock.mock.calls.map((c) => c[0].name)).toEqual(['Bank account', 'Cash', 'Cash']);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Skip always finishes without creating anything', async () => {
    const onDone = jest.fn();
    const tree = await render(onDone);
    await goToAccountStep(tree);
    await press(byLabel(tree, 'Skip'));
    expect(createAccountMock).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('Onboarding restore from a backup', () => {
  const backup = {
    formatVersion: 1,
    exportedAt: '2026-09-20T08:00:00.000Z',
    tables: {
      accounts: [{ id: 'a1' }],
      transactions: [{ date: '2026-09-19' }, { date: '2026-09-18' }],
      loans: [],
    },
  };
  const titled = (tree: ReactTestRenderer, title: string) =>
    tree.root.find((n) => n.props.title === title && typeof n.props.onPress === 'function');

  beforeEach(() => {
    mockBackupFile.current = JSON.stringify(backup);
    (setHasOnboarded as jest.Mock).mockClear();
  });

  it('previews the picked backup, restores it and skips the setup', async () => {
    const onDone = jest.fn();
    const tree = await render(onDone);
    await press(byLabel(tree, 'I have a Yume backup'));
    const texts = tree.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(texts.some((t: string) => t.startsWith('2 entries'))).toBe(true);

    await press(titled(tree, 'Restore this backup'));
    expect(restoreKeepingSafetyCopy).toHaveBeenCalledWith(backup);
    expect(resyncAfterRestore).toHaveBeenCalled();
    expect(setHasOnboarded).toHaveBeenCalledWith(true);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(createAccountMock).not.toHaveBeenCalled();
  });

  it('closing the preview leaves the user on onboarding with nothing restored', async () => {
    const onDone = jest.fn();
    const tree = await render(onDone);
    await press(byLabel(tree, 'I have a Yume backup'));
    // The sheet's ✕ (or a tap outside it) — there's no Cancel button any more.
    await act(async () => {
      tree.root.find((n) => typeof n.props.onCancel === 'function').props.onCancel();
    });
    expect(restoreKeepingSafetyCopy).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(tree.root.findAll((n) => n.props.title === 'Restore this backup')).toHaveLength(0);
  });

  it("says so when the file isn't a backup, and restores nothing", async () => {
    const alert = jest.mocked(showAlert);
    mockBackupFile.current = '{"hello": 1}';
    const tree = await render();
    await press(byLabel(tree, 'I have a Yume backup'));
    expect(alert).toHaveBeenCalledWith(
      "Couldn't open that backup",
      expect.stringContaining("isn't a Yume backup")
    );
    expect(tree.root.findAll((n) => n.props.title === 'Restore this backup')).toHaveLength(0);
    alert.mockRestore();
  });

  it('only offers it on the first slide', async () => {
    const tree = await render();
    await press(cta(tree));
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'I have a Yume backup')).toHaveLength(0);
  });
});
