/**
 * The first-run account step: picked starter accounts are created with
 * their typed balance, a failure keeps the user on the step to retry without
 * ever creating the same account twice, and Skip always gets them out.
 */
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

// The first render loads React Native's component tree, which on a cold, fully
// parallel run (CI, or the whole suite at once) can take longer than Jest's
// 5s default — seen failing that way, never on its own. Generous, not slow.
jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-keyboard-controller', () => ({ KeyboardAvoidingView: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/SuuIllustration', () => ({ SuuIllustration: () => null }));
jest.mock('@/db/ledger', () => ({ createAccount: jest.fn() }));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  setHasOnboarded: jest.fn(async () => {}),
  setUserName: jest.fn(async () => {}),
}));

import { Onboarding } from './Onboarding';
import { createAccount } from '@/db/ledger';
import { setHasOnboarded } from '@/db/settings';

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
 * The CTA fires its async work without returning it (`void getStarted()`), so
 * awaiting onPress alone doesn't wait for it — the assertions only passed when
 * that chain happened to finish first, and under a loaded parallel run it
 * sometimes didn't. Waiting one macrotask lets every queued promise (all the
 * mocks resolve immediately) settle before the test looks.
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

// Loads React Native's lazily-required components once, up front, with a
// generous budget — on a cold, fully parallel run (CI) their first load can
// outlast a single test's time limit, which failed this file intermittently.
beforeAll(async () => {
  await render();
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
